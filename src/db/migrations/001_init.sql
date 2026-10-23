CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE buses (
  id TEXT PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,50}$'),
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incidents (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('pothole','road_damage','accident','signboard','traffic_light','congestion')),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location GEOGRAPHY(Point, 4326) NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','false_positive')),
  observation_count INTEGER NOT NULL DEFAULT 1 CHECK (observation_count >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (last_observed_at >= first_observed_at)
);
CREATE INDEX idx_incidents_location ON incidents USING GIST (location);
CREATE INDEX idx_incidents_type_status ON incidents (event_type, status);
CREATE INDEX idx_incidents_first ON incidents (first_observed_at);
CREATE INDEX idx_incidents_last ON incidents (last_observed_at);

CREATE TABLE observations (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  bus_id TEXT REFERENCES buses(id),
  event_type TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location GEOGRAPHY(Point, 4326) NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_obs_incident ON observations (incident_id);
CREATE INDEX idx_obs_bus ON observations (bus_id);
CREATE INDEX idx_obs_time ON observations (detected_at);
CREATE INDEX idx_obs_location ON observations USING GIST (location);
