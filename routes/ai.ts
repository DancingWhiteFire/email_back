// src/routes/ai.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { botCheck } from "@/middleware/botCheck.js";
import { validateBody } from "@/middleware/validation.js";

const summarizeSchema = z.object({
  text: z.string().min(1),
});

const draftSchema = z.object({
  threadContext: z.string().min(1),
  tone: z.enum(["formal", "casual", "friendly", "short"]).default("short"),
});

export async function aiRoutes(fastify: FastifyInstance) {
  // POST /ai/summarize
  fastify.post(
    "/summarize",
    {
      preHandler: [botCheck, validateBody(summarizeSchema)],
    },
    async (request, reply) => {
      const { text } = request.body as z.infer<typeof summarizeSchema>;

      // TODO: call OpenAI or other LLM here
      const fakeSummary = text.slice(0, 120) + "... (summary)";

      reply.send({ summary: fakeSummary });
    }
  );

  // POST /ai/draft
  fastify.post(
    "/draft",
    {
      preHandler: [botCheck, validateBody(draftSchema)],
    },
    async (request, reply) => {
      const { threadContext, tone } = request.body as z.infer<
        typeof draftSchema
      >;

      // TODO: call OpenAI or other LLM here
      const fakeDraft = `[${tone}] Thanks for your email. Here is a placeholder draft reply based on: ${threadContext.slice(
        0,
        80
      )}...`;

      reply.send({ draft: fakeDraft });
    }
  );
}
