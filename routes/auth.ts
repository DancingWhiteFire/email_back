// src/routes/auth.ts
import type { FastifyInstance } from "fastify";
import { google } from "googleapis";
import {
  createGoogleOAuthClient,
  verifyGoogleIdToken,
} from "@/config/googleClient";
import { User } from "@/models/user.js";
import { GoogleLoginBodyType } from "@/types/routes/auth";
import { FRONTEND_URL } from "@/lib/env";
import { JwtPayload } from "@/types/token";
import { attachClientInfo } from "@/middleware/ipdetect.middleware";
import { botCheck } from "@/middleware/botCheck";

export async function authRoutes(fastify: FastifyInstance) {
  // 1) Start login: redirect to Google
  fastify.post<{ Body: GoogleLoginBodyType }>("/google", async (req, reply) => {
    const { credential } = req.body;
    if (!credential)
      return reply.code(400).send({ error: "Missing credential" });

    try {
      // 1) verify id_token with Google
      const googleUser = await verifyGoogleIdToken(credential);
      // 2) find or create user
      let user = await User.findOne({
        "mails.google.email": googleUser.email,
      });
      if (!user) {
        user = await User.create({
          name: googleUser.name,
          mails: {
            google: {
              email: googleUser.email,
              mailId: googleUser.googleId,
              picture: googleUser.picture,
            },
          },
        });
      } else user.set("updatedAt", new Date());
      await user.save();

      const payload: JwtPayload = {
        userId: user._id.toString(),
        email: user.mails.google!.email,
      };

      // 3) issue our own JWT
      const token = fastify.jwt.sign(payload, { expiresIn: "1d" });

      // 4) (optional) store also as httpOnly cookie
      reply.setCookie("access_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
      });
      const connected = user.mails.google?.accessToken ? true : false;
      return reply.send({
        user: {
          id: user._id.toString(),
          mails: user.mails,
          address: user.address,
          phone: user.phone,
          connected,
        },
        token,
      });
    } catch (err) {
      console.log(err);
      (fastify.log as any).error(err);
      return reply.code(401).send({ error: "Invalid Google token" });
    }
  });

  // 2) Callback: Google redirects here with ?code=...
  fastify.get(
    "/google/callback",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { code } = req.query as { code?: string };

      if (!code) return reply.code(400).send({ error: "Missing code" });
      console.log(req.query, req.user);
      // Identify your logged-in user via JWT / cookie
      const user = await User.findById((req.user as { userId: string }).userId);
      if (!user) return reply.code(401).send({ error: "User not found" });

      const oauth2Client = createGoogleOAuthClient();

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get Google user profile (to confirm)
      const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
      const { data: profile } = await oauth2.userinfo.get();
      const people = google.people({ version: "v1", auth: oauth2Client });

      const res = await people.people.get({
        resourceName: "people/me",
        personFields: "birthdays,addresses,locales,photos,names",
      });
      console.log("Google profile:", profile);
      console.log("Google people API data:", res.data);
      // Save Gmail tokens on your User model (add fields if needed)
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

      // Redirect back to frontend (optional query to show success)
      reply.redirect(`${FRONTEND_URL}/settings?gmail=connected`);
    }
  );

  // 3) /me endpoint to get current user from cookie
  fastify.get(
    "/me",
    { preHandler: [fastify.authenticate, botCheck] },
    async (request, reply) => {
      try {
        const { access_token } = request.cookies as { access_token?: string };

        if (!access_token) return reply.status(401).send({ user: null });

        const payload = fastify.jwt.verify(access_token) as { userId: string };
        const user = await User.findById(payload.userId);

        if (!user) return reply.status(401).send({ user: null });
        const connected = user.mails.google?.accessToken ? true : false;

        return reply.send({
          user: {
            id: user._id.toString(),
            mails: user.mails,
            name: user.name,
            plan: user.plan,
            connected,
          },
        });
      } catch (error) {
        (fastify.log as any).error(error);
        return reply.status(401).send({ user: null });
      }
    }
  );

  // 4) Logout endpoint
  fastify.post(
    "/logout",
    { preHandler: [fastify.authenticate, attachClientInfo] },
    async (request, reply) => {
      reply.clearCookie("access_token", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return reply.send({ success: true });
    }
  );
}
