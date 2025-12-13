// src/middleware/validation.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodSchema } from "zod";

/**
 * Validate request.body against a Zod schema.
 * If validation fails, send 400 and stop the request.
 * If it passes, request.body is replaced with fully parsed data.
 *
 * Usage:
 *   fastify.post(
 *     "/something",
 *     { preHandler: [fastify.authenticate, jwtCheck(mySchema)] },
 *     async (req, reply) => {
 *       // req.body is typed as inferred from schema
 *     }
 *   );
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest<{ Body: T }>, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      const flattened = result.error.flatten();

      // IMPORTANT: return this reply, so Fastify knows we ended the request
      return reply.code(400).send({
        error: "Bad Request",
        message: "Validation failed",
        details: flattened,
      });
    }

    // Overwrite body with parsed, type-safe data (e.g. coerced strings → numbers)
    request.body = result.data;
  };
}
