import * as svc from '../services/analytics.service.js';
export const summary = async (_req, res) => res.json(await svc.summary());
export const traffic = async (req, res) => res.json(await svc.traffic(req.valid.query));
export const hotspots = async (req, res) => res.json(await svc.hotspots(req.valid.query));
