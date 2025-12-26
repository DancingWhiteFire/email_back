import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { botCheck } from "@/middleware/botCheck.js";
import { validateBody } from "@/middleware/validation.middleware.js";

const summarizeSchema = z.object({
  text: z.string().min(1),
});

const draftSchema = z.object({
  threadContext: z.string().min(1),
  tone: z.enum(["formal", "casual", "friendly", "short"]).default("short"),
});

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/summarize",
    {
      preHandler: [botCheck],
    },
    async (request, reply) => {
      const { text } = request.body as z.infer<typeof summarizeSchema>;

      const fakeSummary = text.slice(0, 120) + "... (summary)";

      reply.send({ summary: fakeSummary });
    }
  );

  fastify.post(
    "/draft",
    {
      preHandler: [botCheck],
    },
    async (request, reply) => {
      const { threadContext, tone } = request.body as z.infer<
        typeof draftSchema
      >;

      const fakeDraft = `[${tone}] Thanks for your email. Here is a placeholder draft reply based on: ${threadContext.slice(
        0,
        80
      )}...`;

      reply.send({ draft: fakeDraft });
    }
  );
}
