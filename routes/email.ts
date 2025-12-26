import type { FastifyInstance } from "fastify";
import fs from "fs/promises";
import { google } from "googleapis";
import { GoogleGenAI } from "@google/genai";

import { Email } from "@/models/email.js";
import { User } from "@/models/user";

import { botCheck } from "@/middleware/botCheck.js";
import { attachClientInfo } from "@/middleware/ipdetect.middleware";

import {
  createGoogleOAuthClient,
  getUserGmailClient,
} from "@/config/googleClient";
// import { validateBody } from "@/middleware/validation.middleware";
import { mapGmailMessageToEmail, getGmailMessage } from "@/helper/google";
import { JwtPayload } from "@/types/token";
import { OPENAI_KEY, FRONTEND_URL } from "@/lib/env";

const ai = new GoogleGenAI({ apiKey: OPENAI_KEY });

const decodePubSubData = (dataB64url: string) => {
  const b64 = dataB64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "===".slice((b64.length + 3) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
};
const extractJson = (text: string) => {
  const unfenced = text
    .replace(/```(?:json)?\s*([\s\S]*?)\s*```/i, "$1")
    .trim();

  const m = unfenced.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON object found in model output");
  return JSON.parse(m[0]);
};

export async function emailRoutes(fastify: FastifyInstance) {
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
    "/google/callback",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { code } = req.query as { code?: string };

      if (!code) return reply.code(400).send({ error: "Missing code" });
      console.log(req.query, req.user);
      const user = await User.findById((req.user as { userId: string }).userId);
      if (!user) return reply.code(401).send({ error: "User not found" });

      const oauth2Client = createGoogleOAuthClient();

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
      const { data: profile } = await oauth2.userinfo.get();
      const people = google.people({ version: "v1", auth: oauth2Client });

      const res = await people.people.get({
        resourceName: "people/me",
        personFields: "birthdays,addresses,locales,photos,names",
      });
      console.log("Google profile:", profile);
      console.log("Google people API data:", res.data);
      if (user.mails?.["google"]) {
        user.mails.google.accessToken = tokens.access_token!;
        user.mails.google.refreshToken = tokens.refresh_token!;
        user.mails.google.expiryDate = tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null;
        user.mails.google.scope = tokens.scope!;
        await user.save();
      } else {
        return reply
          .code(500)
          .send({ error: "Google mail information not found for user." });
      }

      reply.redirect(`${FRONTEND_URL}/settings?gmail=connected`);
    }
  );

  fastify.get(
    "/gmail",
    { preHandler: [fastify.authenticate, botCheck, attachClientInfo] },
    async (request, reply) => {
      const authUser = request.user as JwtPayload;
      const user = await User.findById(authUser.userId);
      if (!user) return reply.code(401).send({ error: "User not found" });

      // const { pageToken } = request.body as { pageToken?: string };

      const gmail = await getUserGmailClient(user);
      const listRes = await gmail.users.messages.list({
        userId: "me",
        maxResults: 20,
        q: "in:trash",
        // ...(pageToken ? { pageToken } : {}),
      });
      console.log(listRes.data);
      const messages = listRes.data.messages ?? [];
      if (!messages.length) return reply.send({ messages: [] });
      const fullMessages = await Promise.all(
        messages.map(async (m) => await getGmailMessage(gmail, m.id!))
      );
      const normalized = fullMessages.map((m) =>
        mapGmailMessageToEmail(user._id, m.data)
      );
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
        user.mails.google!.lastHistoryId = String(response.data.historyId);
        await user.save();
        return response.data;
      } catch (error) {
        console.error("Error setting up watch:", error);
      }
    }
  );

  fastify.post("/gmail/push", async (request, reply) => {
    const body: any = request.body;

    let emailAddress = body?.emailAddress;
    let historyId = body?.historyId;

    if (!emailAddress || !historyId) {
      const data = body?.message?.data;
      if (!data) return reply.code(400).send({ error: "Missing message.data" });

      const payload = decodePubSubData(data);
      emailAddress = payload?.emailAddress;
      historyId = payload?.historyId;
    }

    if (!emailAddress || !historyId)
      return reply.code(400).send({ error: "Bad Gmail notification payload" });

    reply.code(204).send();

    try {
      const user = await User.findOne({ "mails.google.email": emailAddress });
      if (!user?.mails?.google) return;

      const gmail = await getUserGmailClient(user);

      const notifHistoryId = String(historyId);
      const startHistoryId = String(
        user.mails.google.lastHistoryId || historyId
      );

      const newMessageIds = new Set<string>();
      let latestHistoryId: string | undefined;

      const histRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
      });

      // await fs.writeFile(
      //   `history-gmail-${startHistoryId}.json`,
      //   JSON.stringify(histRes.data, null, 2),
      //   "utf-8"
      // );
      latestHistoryId = String(
        histRes.data.historyId || latestHistoryId || notifHistoryId
      );

      const history = histRes.data.history || [];
      for (const h of history) {
        for (const added of h.messagesAdded || []) {
          const msg = added.message;
          if (!msg?.id) continue;

          const labels = msg.labelIds || [];
          const isDraft = labels.includes("DRAFT");
          if (!isDraft) newMessageIds.add(msg.id);
        }
      }

      user.mails.google.lastHistoryId = latestHistoryId || notifHistoryId;
      await user.save();

      if (newMessageIds.size) {
        const ids = [...newMessageIds];

        for (const id of ids) {
          const msgRes = await getGmailMessage(gmail, id);
          await fs.writeFile(
            `history-gmail-${startHistoryId}-message-${id}.json`,
            JSON.stringify(
              mapGmailMessageToEmail(user._id, msgRes.data),
              null,
              2
            ),
            "utf-8"
          );
          const { sender, subject, snippet } = mapGmailMessageToEmail(
            user._id,
            msgRes.data
          );
          const system = `When an email is received, the system analyzes its content and assigns labels automatically. Possible labels include Notification, Response, Social, Job, Call Schedule, Reject, etc. The system can return one or multiple labels, but only the most relevant ones.`;

          const prompt = `From: ${sender ?? ""} Subject: ${
            subject ?? ""
          } Snippet: ${snippet ?? ""} return only labels.`;
          const res = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              { role: "user", parts: [{ text: system + "\n" + prompt }] },
            ],
          });
          const text: string =
            res?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

          // await fs.writeFile(
          //   `history-gmail-${startHistoryId}-message-${id}-ai.json`,
          //   JSON.stringify(res, null, 2),
          //   "utf-8"
          // );
          // let labels: string[] = [];
          // const obj = extractJson(text);
          // if (Array.isArray(obj?.labels)) labels = obj.labels.map(String);
          console.log(text);
        }
      }
    } catch (err: any) {
      if (err?.code === 404 || err?.response?.status === 404) {
        const user = await User.findOne({ "mails.google.email": emailAddress });
        if (user?.mails?.google) {
          user.mails.google.lastHistoryId = String(historyId);
          await user.save();
        }
        return;
      }

      console.log("gmail push processing error:", err);
    }
  });

  fastify.post("/gmail/ai", async (request, reply) => {
    const { from, subject, snippet } = request.body as {
      from?: string;
      subject?: string;
      snippet?: string;
    };
    const system = `When an email is received, the system analyzes its content and assigns labels automatically. Possible labels include Notification, Response, Social, Job, Call Schedule, Reject, etc. The system can return one or multiple labels, but only the most relevant ones.`;

    const prompt = `From: ${from ?? ""} Subject: ${subject ?? ""} Snippet: ${
      snippet ?? ""
    } Return JSON only.`;
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: system + "\n" + prompt }] }],
    });
    const text: string = res?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    await fs.writeFile("ai.json", JSON.stringify(res, null, 2), "utf-8");

    let labels: string[] = [];
    try {
      const obj = extractJson(text);
      if (Array.isArray(obj?.labels)) labels = obj.labels.map(String);
    } catch (e) {
      labels = ["Notification"];
    }
    console.log("ai test", labels);
    reply.code(200).send(labels);
  });
}
