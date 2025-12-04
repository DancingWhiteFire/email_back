// src/middleware/botCheck.ts
import type { FastifyReply, FastifyRequest } from "fastify";

export async function botCheck(request: FastifyRequest, reply: FastifyReply) {
  const headerToken = request.headers["x-bot-check"];
  const secret = process.env.BOT_SECRET;

  if (!secret) {
    console.warn("BOT_SECRET is not set. botCheck middleware is bypassed.");
    return;
  }

  if (!headerToken || headerToken !== secret) {
    reply.code(403).send({
      error: "Forbidden",
      message: "Bot check failed",
    });
  }
}
