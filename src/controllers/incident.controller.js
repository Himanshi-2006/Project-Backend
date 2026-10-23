import * as svc from '../services/incident.service.js';
export const create = async (req, res) => {
  const r = await svc.ingestDetection(req.valid.body);
  res.status(r.created ? 201 : 200).json(r); // 201 = new incident, 200 = merged into existing
};
export const list = async (req, res) => res.json(await svc.listIncidents(req.valid.query));
export const nearby = async (req, res) => res.json(await svc.nearbyIncidents(req.valid.query));
export const getOne = async (req, res) => res.json(await svc.getIncident(req.valid.params.id));
export const patch = async (req, res) => res.json(await svc.updateStatus(req.valid.params.id, req.valid.body.status));
