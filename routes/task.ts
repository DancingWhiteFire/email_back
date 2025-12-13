// src/routes/tasks.ts
import type { FastifyInstance } from "fastify";
import { Types } from "mongoose";
import { z } from "zod";
import { botCheck } from "@/middleware/botCheck.js";
import { validateBody } from "@/middleware/validation.middleware.js";
import { Task } from "@/models/task.js";

const createTaskFromEmailSchema = z.object({
  title: z.string().min(1),
  ownerId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), "Invalid ownerId"),
  dueDate: z.string().datetime().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(["todo", "in-progress", "done"]).optional(),
  dueDate: z.string().datetime().optional(),
});

export async function taskRoutes(fastify: FastifyInstance) {
  // GET /tasks?ownerId=...
  fastify.get("/", { preHandler: [botCheck] }, async (request, reply) => {
    const query = request.query as { ownerId?: string };
    if (!query.ownerId || !Types.ObjectId.isValid(query.ownerId)) {
      reply.code(400).send({ error: "ownerId is required and must be valid" });
      return;
    }

    const tasks = await Task.find({ ownerId: query.ownerId }).sort({
      createdAt: -1,
    });

    reply.send(tasks);
  });

  // POST /tasks/from-email/:emailId
  fastify.post(
    "/from-email/:emailId",
    {
      preHandler: [botCheck],
    },
    async (request, reply) => {
      const { emailId } = request.params as { emailId: string };
      if (!Types.ObjectId.isValid(emailId)) {
        reply.code(400).send({ error: "Invalid emailId" });
        return;
      }

      const { title, ownerId, dueDate } = request.body as z.infer<
        typeof createTaskFromEmailSchema
      >;

      const task = await Task.create({
        title,
        ownerId,
        emailId,
        ...(dueDate && { dueDate: new Date(dueDate) }),
      });

      reply.code(201).send(task);
    }
  );

  // PATCH /tasks/:id
  fastify.patch(
    "/:id",
    {
      preHandler: [botCheck],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!Types.ObjectId.isValid(id)) {
        reply.code(400).send({ error: "Invalid task id" });
        return;
      }

      const updatesRaw = request.body as z.infer<typeof updateTaskSchema>;
      const updates: any = { ...updatesRaw };

      if (updates.dueDate) {
        updates.dueDate = new Date(updates.dueDate);
      }

      const task = await Task.findByIdAndUpdate(id, updates, { new: true });
      if (!task) {
        reply.code(404).send({ error: "Task not found" });
        return;
      }

      reply.send(task);
    }
  );

  // DELETE /tasks/:id
  fastify.delete("/:id", { preHandler: [botCheck] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!Types.ObjectId.isValid(id)) {
      reply.code(400).send({ error: "Invalid task id" });
      return;
    }

    const result = await Task.findByIdAndDelete(id);
    if (!result) {
      reply.code(404).send({ error: "Task not found" });
      return;
    }

    reply.code(204).send();
  });
}
