// src/routes/emails.ts
import type { FastifyInstance } from "fastify";
import { botCheck } from "@/middleware/botCheck.js";
import { getUserGmailClient } from "@/config/googleClient";
import { User } from "@/models/user";
import { Label } from "@/models/label";
import { JwtPayload } from "@/types/token";
import { attachClientInfo } from "@/middleware/ipdetect.middleware";
// import fs from "fs/promises";

import { z } from "zod";
import { validateBody } from "@/middleware/validation.middleware";

export const GMAIL_LABEL_COLORS = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#cccccc",
  "#efefef",
  "#f3f3f3",
  "#ffffff",
  "#fb4c2f",
  "#ffad47",
  "#fad165",
  "#16a766",
  "#43d692",
  "#4a86e8",
  "#a479e2",
  "#f691b3",
  "#f6c5be",
  "#ffe6c7",
  "#fef1d1",
  "#b9e4d0",
  "#c6f3de",
  "#c9daf8",
  "#e4d7f5",
  "#fcdee8",
  "#efa093",
  "#ffd6a2",
  "#fce8b3",
  "#89d3b2",
  "#a0eac9",
  "#a4c2f4",
  "#d0bcf1",
  "#fbc8d9",
  "#e66550",
  "#ffbc6b",
  "#fcda83",
  "#44b984",
  "#68dfa9",
  "#6d9eeb",
  "#b694e8",
  "#f7a7c0",
  "#cc3a21",
  "#eaa041",
  "#f2c960",
  "#149e60",
  "#3dc789",
  "#3c78d8",
  "#8e63ce",
  "#e07798",
  "#ac2b16",
  "#cf8933",
  "#d5ae49",
  "#0b804b",
  "#2a9c68",
  "#285bac",
  "#653e9b",
  "#b65775",
  "#822111",
  "#a46a21",
  "#aa8831",
  "#076239",
  "#1a764d",
  "#1c4587",
  "#41236d",
  "#83334c",
  "#464646",
  "#e7e7e7",
  "#0d3472",
  "#b6cff5",
  "#0d3b44",
  "#98d7e4",
  "#3d188e",
  "#e3d7ff",
  "#711a36",
  "#fbd3e0",
  "#8a1c0a",
  "#f2b2a8",
  "#7a2e0b",
  "#ffc8af",
  "#7a4706",
  "#ffdeb5",
  "#594c05",
  "#fbe983",
  "#684e07",
  "#fdedc1",
  "#0b4f30",
  "#b3efd3",
  "#04502e",
  "#a2dcc1",
  "#c2c2c2",
  "#4986e7",
  "#2da2bb",
  "#b99aff",
  "#994a64",
  "#f691b2",
  "#ff7537",
  "#ffad46",
  "#662e37",
  "#ebdbde",
  "#cca6ac",
  "#094228",
  "#42d692",
  "#16a765",
] as const;
const ALLOWED = new Set(GMAIL_LABEL_COLORS);

export const gmailPaletteColor = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.string().refine((v) => ALLOWED.has(v as any), {
    message: "Color must be one of Gmail's supported values",
  })
);
const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "Invalid hex color");

export const createLabelSchema = z
  .object({
    labelName: z.string().trim().min(1, "labelName is required").max(225),

    // body can be strings -> keep as string, just validate format
    textColor: gmailPaletteColor.optional(),
    backgroundColor: gmailPaletteColor.optional(),

    // optional controls (if you want to expose them)
    labelListVisibility: z
      .enum(["labelShow", "labelHide", "labelShowIfUnread"])
      .default("labelShow"),

    messageListVisibility: z.enum(["show", "hide"]).default("show"),
  })
  .strict();

export const updateLabelSchema = z
  .object({
    _id: z.string(),
    labelName: z.string().trim().min(1, "labelName is required").max(225),

    // body can be strings -> keep as string, just validate format
    textColor: gmailPaletteColor.optional(),
    backgroundColor: gmailPaletteColor.optional(),

    // optional controls (if you want to expose them)
    labelListVisibility: z
      .enum(["labelShow", "labelHide", "labelShowIfUnread"])
      .default("labelShow"),

    messageListVisibility: z.enum(["show", "hide"]).default("show"),
  })
  .strict();

export const deleteLabelSchema = z
  .object({
    _id: z.string(),
  })
  .strict();

export type CreateLabelBody = z.infer<typeof createLabelSchema>;
export type UpdateLabelBody = z.infer<typeof updateLabelSchema>;
export type DeleteLabelBody = z.infer<typeof deleteLabelSchema>;

export async function labelRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate, botCheck, attachClientInfo],
    },
    async (request, reply) => {
      const authUser = request.user as JwtPayload;
      const user = await User.findById(authUser.userId);
      if (!user) return reply.code(401).send({ error: "User not found" });
      const gmail = await getUserGmailClient(user);
      const res = await gmail.users.labels.list({
        userId: "me",
      });
      // await fs.writeFile(
      //   "label-get-messages.json", // path on server
      //   JSON.stringify(res, null, 2), // pretty JSON
      //   "utf-8"
      // );
      return res.data.labels;
    }
  );
  fastify.post<{ Body: CreateLabelBody }>(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        botCheck,
        attachClientInfo,
        validateBody(createLabelSchema),
      ],
    },
    async (request, reply) => {
      const authUser = request.user as JwtPayload;
      const user = await User.findById(authUser.userId);
      const {
        labelName,
        textColor,
        backgroundColor,
        labelListVisibility,
        messageListVisibility,
      } = request.body;
      if (!user) return reply.code(401).send({ error: "User not found" });

      const gmail = await getUserGmailClient(user);

      // 1) List message IDs
      const createLabel = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: labelName,
          labelListVisibility,
          messageListVisibility,
          ...(textColor && backgroundColor
            ? { color: { textColor, backgroundColor } }
            : {}),
        },
      });
      // await fs.writeFile(
      //   "label-create-messages.json", // path on server
      //   JSON.stringify(createLabel, null, 2), // pretty JSON
      //   "utf-8"
      // );
      return reply.send({ messages: createLabel });
    }
  );
  fastify.patch<{ Body: UpdateLabelBody }>(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        botCheck,
        attachClientInfo,
        validateBody(updateLabelSchema),
      ],
    },
    async (request, reply) => {
      const authUser = request.user as JwtPayload;
      const user = await User.findById(authUser.userId);
      const {
        _id,
        labelName,
        textColor,
        backgroundColor,
        labelListVisibility,
        messageListVisibility,
      } = request.body;
      if (!user) return reply.code(401).send({ error: "User not found" });

      const gmail = await getUserGmailClient(user);

      const label = await Label.findById(_id);
      if (!label) return reply.code(404).send({ error: "Label not found" });

      // 1) List message IDs
      const updateLabel = await gmail.users.labels.update({
        userId: "me",
        requestBody: {
          name: labelName,
          id: label.labelId,
          labelListVisibility,
          messageListVisibility,
          ...(textColor && backgroundColor
            ? { color: { textColor, backgroundColor } }
            : {}),
        },
      });
      // await fs.writeFile(
      //   "label-update-messages.json", // path on server
      //   JSON.stringify(updateLabel, null, 2), // pretty JSON
      //   "utf-8"
      // );
      return reply.send({ messages: updateLabel });
    }
  );
  fastify.delete<{ Body: DeleteLabelBody }>(
    "/",
    {
      preHandler: [fastify.authenticate, botCheck, attachClientInfo],
    },
    async (request, reply) => {
      const authUser = request.user as JwtPayload;
      const user = await User.findById(authUser.userId);
      const { _id } = request.body;
      if (!user) return reply.code(401).send({ error: "User not found" });

      const gmail = await getUserGmailClient(user);

      const label = await Label.findById(_id);
      if (!label) return reply.code(404).send({ error: "Label not found" });

      // 1) List message IDs
      const deleteLabel = await gmail.users.labels.delete({
        userId: "me",
        id: label.labelId,
      });
      // await fs.writeFile(
      //   "label-delete-messages.json", // path on server
      //   JSON.stringify(deleteLabel, null, 2), // pretty JSON
      //   "utf-8"
      // );
      return reply.send({ messages: deleteLabel });
    }
  );
}
