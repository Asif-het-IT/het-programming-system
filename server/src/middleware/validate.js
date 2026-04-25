export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next({
        status: 400,
        message: 'Validation failed',
        details: result.error.flatten(),
      });
    }

    if (source === 'query') {
      req.validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }
    return next();
  };
}
