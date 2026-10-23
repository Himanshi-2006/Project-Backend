import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as s from '../schemas/incident.schema.js';
import * as c from '../controllers/incident.controller.js';
const r = Router();
r.post('/', validate(s.detectionBody), h(c.create));
r.get('/', validate(s.listQuery, 'query'), h(c.list));
r.get('/nearby', validate(s.nearbyQuery, 'query'), h(c.nearby)); // must come before '/:id'
r.get('/:id', validate(s.idParams, 'params'), h(c.getOne));
r.patch('/:id', validate(s.idParams, 'params'), validate(s.patchBody), h(c.patch));
export default r;
