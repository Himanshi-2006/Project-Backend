// validate(schema, 'body' | 'query' | 'params') -> parsed values land in req.valid[source]
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[source]);
  if (!r.success) return next(r.error);
  req.valid = { ...req.valid, [source]: r.data };
  next();
};
