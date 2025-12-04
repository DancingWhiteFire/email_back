// src/routes/auth.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { googleClient } from "../config/googleClient";
import { User } from "../models/user.js";

export async function authRoutes(fastify: FastifyInstance) {
  // 1) Start login: redirect to Google
  fastify.get("/google", async (request, reply) => {
    console.log("google", request);
    if (!googleClient) {
      return reply.status(500).send({ error: "Google OAuth not configured" });
    }

    const url = googleClient.generateAuthUrl({
      access_type: "offline", // get refresh_token (if needed)
      prompt: "consent", // always show account chooser
      scope: ["openid", "email", "profile"],
    });

    reply.redirect(url);
  });

  // 2) Callback: Google redirects here with ?code=...
  fastify.get("/google/callback", async (request, reply) => {
    if (!googleClient) {
      return reply.status(500).send({ error: "Google OAuth not configured" });
    }

    const { code, error } = request.query as {
      code?: string;
      error?: string;
    };

    if (error) {
      (fastify.log as any).error({ error }, "Google OAuth error");
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return reply.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return reply.redirect(`${frontendUrl}/login?error=missing_code`);
    }

    try {
      // Exchange code for tokens
      const { tokens } = await googleClient.getToken(code);
      const idToken = tokens.id_token;

      if (!idToken) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return reply.redirect(`${frontendUrl}/login?error=no_id_token`);
      }

      // Verify ID token, get user info
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID!,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return reply.redirect(`${frontendUrl}/login?error=invalid_payload`);
      }

      const googleId = payload.sub;
      const email = payload.email;
      const name = payload.name || email.split("@")[0];
      const picture = payload.picture;

      // Find or create user in database
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ email, name });
      } else if (user.name !== name) {
        // Update name if it changed
        user.name = name || "";
        await user.save();
      }

      // Create JWT token
      const token = fastify.jwt.sign({ userId: user._id.toString() });

      // Set httpOnly cookie and redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

      reply
        .setCookie("access_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", // true in production with HTTPS
          path: "/",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        })
        .redirect(`${frontendUrl}/`);
    } catch (error) {
      (fastify.log as any).error(error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return reply.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    }
  });

  // 3) /me endpoint to get current user from cookie
  fastify.get("/me", async (request, reply) => {
    try {
      const { access_token } = request.cookies as { access_token?: string };

      if (!access_token) {
        return reply.status(401).send({ user: null });
      }

      const payload = fastify.jwt.verify(access_token) as { userId: string };
      const user = await User.findById(payload.userId);

      if (!user) {
        return reply.status(401).send({ user: null });
      }

      return reply.send({
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          plan: user.plan,
        },
      });
    } catch (error) {
      (fastify.log as any).error(error);
      return reply.status(401).send({ user: null });
    }
  });

  // 4) Logout endpoint
  fastify.post("/logout", async (request, reply) => {
    reply.clearCookie("access_token", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return reply.send({ success: true });
  });
}
