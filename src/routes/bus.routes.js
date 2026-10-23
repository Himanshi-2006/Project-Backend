import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { busParams } from '../schemas/incident.schema.js';
import * as c from '../controllers/bus.controller.js';
const r = Router();
r.get('/', h(c.list));
r.get('/:id', validate(busParams, 'params'), h(c.getOne));
export default r;
