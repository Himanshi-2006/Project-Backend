import request from 'supertest';
import pg from 'pg';
import { bootstrap, reset, det } from './setup.js';

const { app, db } = await bootstrap();
const post = (o) => request(app).post('/api/incidents').send(det(o));
beforeEach(() => reset(db));
afterAll(() => db.getPool().end());

describe('health', () => {
  test('reports API and database up', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200); expect(r.body).toEqual({ status: 'ok', database: 'up' });
  });
  test('returns 503 without leaking internals when the database is down', async () => {
    const good = db.getPool();
    db.setPool(new pg.Pool({ connectionString: 'postgresql://u:secretpw@127.0.0.1:1/none', connectionTimeoutMillis: 500 }));
    const h = await request(app).get('/api/health');
    const l = await request(app).get('/api/incidents');
    db.setPool(good);
    expect(h.status).toBe(503);
    expect(l.status).toBe(503); expect(l.body.error.code).toBe('database_unavailable'); expect(JSON.stringify(l.body)).not.toMatch(/secretpw/);
  });
});

describe('submission and validation', () => {
  test('creates an incident (201) and returns it with history', async () => {
    const r = await post();
    expect(r.status).toBe(201); expect(r.body.created).toBe(true); expect(r.body.incident_id).toBe('INC000001');
    const g = await request(app).get('/api/incidents/INC000001');
    expect(g.body.bus_id).toBe('BUS_101'); expect(g.body.observations).toHaveLength(1);
  });
  test.each([[{ latitude: 91 }], [{ longitude: -181 }], [{ confidence: 1.5 }], [{ confidence: -0.1 }],
    [{ timestamp: '2026-10-14T10:00:00' }], [{ timestamp: 'yesterday' }], [{ event_type: 'ufo' }], [{ bus_id: 'bad id!' }]])('rejects %j', async (bad) => {
    const r = await post(bad);
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('validation_error');
  });
  test('rejects missing timestamp and malformed JSON', async () => {
    const { timestamp, ...rest } = det();
    expect((await request(app).post('/api/incidents').send(rest)).status).toBe(422);
    expect((await request(app).post('/api/incidents').set('Content-Type', 'application/json').send('{bad')).status).toBe(400);
  });
  test('normalises timestamps to UTC', async () => {
    const r = await post({ timestamp: '2026-10-14T15:30:00+05:30' });
    expect(r.body.incident.timestamp).toBe('2026-10-14T10:00:00.000Z');
  });
});

describe('fusion', () => {
  test('two buses reporting the same pothole merge and keep both observations', async () => {
    const a = await post();
    const b = await post({ bus_id: 'BUS_102', latitude: 30.73335, timestamp: '2026-10-14T12:00:00Z', confidence: 1 });
    expect(b.status).toBe(200); expect(b.body.created).toBe(false); expect(b.body.incident_id).toBe(a.body.incident_id);
    const g = (await request(app).get(`/api/incidents/${a.body.incident_id}`)).body;
    expect(g.observation_count).toBe(2); expect(g.observations).toHaveLength(2); expect(g.confidence).toBeCloseTo(0.95);
    expect(g.last_observed_at).toBe('2026-10-14T12:00:00.000Z');
  });
  test('simultaneous reports create only one incident', async () => {
    const rs = await Promise.all([1, 2, 3, 4, 5].map((n) => post({ bus_id: `BUS_${n}` })));
    expect(rs.filter((r) => r.body.created)).toHaveLength(1);
    expect((await request(app).get('/api/incidents')).body.total).toBe(1);
  });
  test('far apart, different type, or outside time window stay separate', async () => {
    await post();
    expect((await post({ latitude: 30.7343 })).status).toBe(201);
    expect((await post({ event_type: 'road_damage' })).status).toBe(201);
    await post({ event_type: 'accident' });
    expect((await post({ event_type: 'accident', timestamp: '2026-10-14T13:00:00Z' })).status).toBe(201);
  });
  test('a resolved incident is not reopened by new detections', async () => {
    await post(); await request(app).patch('/api/incidents/INC000001').send({ status: 'resolved' });
    expect((await post()).status).toBe(201);
  });
});

describe('retrieval, status and analytics', () => {
  test('filters and pagination', async () => {
    for (let i = 0; i < 5; i++) await post({ latitude: 30.7 + i * 0.01 });
    await post({ event_type: 'accident', latitude: 30.9 });
    expect((await request(app).get('/api/incidents')).body.total).toBe(6);
    const p = (await request(app).get('/api/incidents?event_type=pothole&limit=2&offset=4')).body;
    expect(p.total).toBe(5); expect(p.incidents).toHaveLength(1);
    expect((await request(app).get('/api/incidents?limit=5000')).status).toBe(422);
    expect((await request(app).get('/api/incidents?bbox=76,30.89,77,31')).body.total).toBe(1);
    expect((await request(app).get('/api/incidents?bus_id=BUS_999')).body.total).toBe(0);
    expect((await request(app).get('/api/incidents/INC000999')).status).toBe(404);
  });
  test('status update and nearby search', async () => {
    await post();
    const u = await request(app).patch('/api/incidents/INC000001').send({ status: 'investigating' });
    expect(u.body.status).toBe('investigating');
    expect((await request(app).patch('/api/incidents/INC000001').send({ status: 'bogus' })).status).toBe(422);
    expect((await request(app).get('/api/incidents/nearby?latitude=30.7333&longitude=76.7794&radius_m=50')).body.count).toBe(1);
    expect((await request(app).get('/api/incidents/nearby?latitude=31&longitude=77&radius_m=50')).body.count).toBe(0);
  });
  test('analytics, buses', async () => {
    await post(); await post({ event_type: 'congestion', latitude: 30.8, vehicle_count: 40, bus_id: 'BUS_102' });
    const s = (await request(app).get('/api/analytics/summary')).body;
    expect(s).toMatchObject({ total_incidents: 2, open_incidents: 2, resolved_incidents: 0 }); expect(s.by_type.pothole).toBe(1);
    const t = (await request(app).get('/api/analytics/traffic')).body;
    expect(t.congestion_by_day[0].vehicle_count).toBe(40);
    expect((await request(app).get('/api/analytics/hotspots?min_incidents=1')).body.hotspots.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/buses')).body.count).toBe(2);
    expect((await request(app).get('/api/buses/BUS_101')).body.observation_count).toBe(1);
    expect((await request(app).get('/api/buses/NOPE')).status).toBe(404);
  });
});
