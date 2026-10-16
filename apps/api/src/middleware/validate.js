// ── Zod Validation Middleware ──
// Validates req.body / req.query / req.params against a Zod schema.

/**
 * validate — creates middleware that validates the specified request part.
 * Usage: validate(myZodSchema) — validates req.body
 *        validate(myZodSchema, 'query') — validates req.query
 *        validate(myZodSchema, 'params') — validates req.params
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    // Replace with parsed (coerced/defaulted) data
    req[source] = result.data;
    next();
  };
}
