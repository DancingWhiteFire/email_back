// src/middleware/validation.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodSchema } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      reply.code(400).send({
        error: "Bad Request",
        message: "Validation failed",
        details: result.error.flatten(),
      });
      return;
    }

    // overwrite body with parsed data
    (request as any).body = result.data;
  };
}
