// src/routes/emails.ts
import type { FastifyInstance } from "fastify";
import { Types } from "mongoose";
import { Email } from "../models/email.js";
import { botCheck } from "../middleware/botCheck.js";

export async function emailRoutes(fastify: FastifyInstance) {
  // GET /emails?status=inbox
  fastify.get(
    "/",
    { preHandler: [botCheck] },
    async (request, reply) => {
      const query = request.query as { status?: string; userId?: string };
      const status = query.status ?? "inbox";
      const userId = query.userId;

      if (!userId || !Types.ObjectId.isValid(userId)) {
        reply.code(400).send({ error: "userId is required and must be valid" });
        return;
      }

      const emails = await Email.find({ userId, status }).sort({
        receivedAt: -1
      });

      reply.send(emails);
    }
  );

  // POST /emails/:id/archive
  fastify.post(
    "/:id/archive",
    { preHandler: [botCheck] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const email = await Email.findByIdAndUpdate(
        id,
        { status: "archived" },
        { new: true }
      );
      if (!email) {
        reply.code(404).send({ error: "Email not found" });
        return;
      }
      reply.send(email);
    }
  );

  // POST /emails/:id/delete
  fastify.post(
    "/:id/delete",
    { preHandler: [botCheck] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const email = await Email.findByIdAndUpdate(
        id,
        { status: "deleted" },
        { new: true }
      );
      if (!email) {
        reply.code(404).send({ error: "Email not found" });
        return;
      }
      reply.send(email);
    }
  );

  // POST /emails/:id/pin
  fastify.post(
    "/:id/pin",
    { preHandler: [botCheck] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const email = await Email.findByIdAndUpdate(
        id,
        { status: "pinned" },
        { new: true }
      );
      if (!email) {
        reply.code(404).send({ error: "Email not found" });
        return;
      }
      reply.send(email);
    }
  );
}
