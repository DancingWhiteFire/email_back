// src/routes/emails.ts
import type { FastifyInstance } from "fastify";
import { Types } from "mongoose";
import { Email } from "@/models/email.js";
import { botCheck } from "@/middleware/botCheck.js";
import {
  createGoogleOAuthClient,
  getUserGmailClient,
} from "@/config/googleClient";
// import { validateBody } from "@/middleware/validation.middleware";
import { User } from "@/models/user";
import { mapGmailMessageToEmail } from "@/helper/google";
import { JwtPayload } from "@/types/token";
import { attachClientInfo } from "@/middleware/ipdetect.middleware";
// import fs from "fs/promises";

export async function emailRoutes(fastify: FastifyInstance) {
  // Ensure user is authenticated (assumes you already have this decorator)
  fastify.get(
    "/google/prepare/oauth",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const oauth2Client = createGoogleOAuthClient();

      const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/gmail.labels",
          "https://www.googleapis.com/auth/user.birthday.read",
          "https://www.googleapis.com/auth/user.addresses.read",
          "https://www.googleapis.com/auth/user.phonenumbers.read",
        ],
      });

      return reply.send({ url });
    }
  );

  fastify.get(
    "/gmail",
    { preHandler: [fastify.authenticate, botCheck, attachClientInfo] },
    async (request, reply) => {
      const authUser = request.user as JwtPayload;
      const user = await User.findById(authUser.userId);
      if (!user) return reply.code(401).send({ error: "User not found" });

      const { pageToken } = request.body as { pageToken?: string };

      const gmail = await getUserGmailClient(user);
      // 1) List message IDs
      const listRes = await gmail.users.messages.list({
        userId: "me",
        maxResults: 20,
        q: "in:trash",
        ...(pageToken ? { pageToken } : {}),
      });
      console.log(listRes.data);
      const messages = listRes.data.messages ?? [];
      if (!messages.length) return reply.send({ messages: [] });
      // 2) Fetch full message for each ID
      const fullMessages = await Promise.all(
        messages.map((m) =>
          gmail.users.messages.get({
            userId: "me",
            id: m.id!,
            format: "full",
          })
        )
      );
      // await fs.writeFile(
      //   "gmail-messages.json", // path on server
      //   JSON.stringify(fullMessages, null, 2), // pretty JSON
      //   "utf-8"
      // );
      // 3) Normalize & optionally save to Mongo
      const normalized = fullMessages.map((m) =>
        mapGmailMessageToEmail(user._id, m.data)
      );

      // Upsert into Mongo (optional)
      await Email.bulkWrite(
        normalized.map((n) => ({
          updateOne: {
            filter: { userId: n.userId, providerMsgId: n.providerMsgId },
            update: { $set: n },
            upsert: true,
          },
        }))
      );

      return reply.send({ messages: normalized });
    }
  );

  fastify.get(
    "/gmail/sync",
    { preHandler: [fastify.authenticate, botCheck, attachClientInfo] },
    async (request, reply) => {
      const authUser = request.user as JwtPayload;
      const user = await User.findById(authUser.userId);
      if (!user) return reply.code(401).send({ error: "User not found" });
      const gmail = await getUserGmailClient(user);
      try {
        const response = await gmail.users.watch({
          userId: "me",
          requestBody: {
            topicName:
              "projects/caramel-dialect-480214-k3/topics/gmail-notifications",
          },
        });
        console.log("Watch request successfully created:", response.data);
        return response.data;
      } catch (error) {
        console.error("Error setting up watch:", error);
      }
    }
  );
  // GET /emails?status=inbox
  fastify.get("/", { preHandler: [botCheck] }, async (request, reply) => {
    const query = request.query as { status?: string; userId?: string };
    const status = query.status ?? "inbox";
    const userId = query.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      reply.code(400).send({ error: "userId is required and must be valid" });
      return;
    }

    const emails = await Email.find({ userId, status }).sort({
      receivedAt: -1,
    });

    reply.send(emails);
  });

  fastify.post("/gmail/push", async (request, reply) => {
    // Optional: verify Pub/Sub OIDC token if you configured it on the subscription
    // If you didn't configure OIDC, set PUBSUB_OIDC_AUDIENCE empty and skip.
    // const ok = await verifyPubSubOidcIfConfigured(request.headers);
    // if (!ok) return reply.code(401).send({ error: "Invalid Pub/Sub auth" });

    const { emailAddress, historyId } = request.body as any;

    if (!emailAddress || !historyId) {
      return reply.code(400).send({ error: "Bad Pub/Sub message" });
    }
    console.log(request.body);

    // Ack fast (Pub/Sub retries if you are slow / error)
    reply.code(204).send();
  });

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
