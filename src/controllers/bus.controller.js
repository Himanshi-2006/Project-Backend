import * as svc from '../services/bus.service.js';
export const list = async (_req, res) => res.json(await svc.list());
export const getOne = async (req, res) => res.json(await svc.get(req.valid.params.id));
