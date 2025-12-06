// src/routes/auth.ts
import type { FastifyInstance } from "fastify";
import { googleClient, verifyGoogleIdToken } from "@/config/googleClient";
import { User } from "@/models/user.js";

interface GoogleLoginBody {
  credential: string; // ID token from GIS
}

export async function authRoutes(fastify: FastifyInstance) {
  // 1) Start login: redirect to Google
  fastify.post<{ Body: GoogleLoginBody }>("/google", async (req, reply) => {
    const { credential } = req.body;
    if (!credential)
      return reply.code(400).send({ error: "Missing credential" });

    try {
      // 1) verify id_token with Google
      const googleUser = await verifyGoogleIdToken(credential);

      // 2) find or create user
      let user = await User.findOne({ "mails.google.email": googleUser.email });
      console.log(googleUser);
      if (!user)
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
      else user.set("updatedAt", new Date());

      await user.save();

      // 3) issue our own JWT
      const token = fastify.jwt.sign(
        { userId: user._id.toString() },
        { expiresIn: "1d" }
      );

      // 4) (optional) store also as httpOnly cookie
      reply.setCookie("access_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
      });

      return reply.send({
        user: {
          id: user._id.toString(),
          mails: user.mails,
          address: user.address,
          phone: user.phone,
        },
        token,
      });
    } catch (err) {
      (fastify.log as any).error(err);
      return reply.code(401).send({ error: "Invalid Google token" });
    }
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
      console.log("ID Token:", idToken);

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

      if (!access_token) return reply.status(401).send({ user: null });

      const payload = fastify.jwt.verify(access_token) as { userId: string };
      const user = await User.findById(payload.userId);

      if (!user) return reply.status(401).send({ user: null });

      return reply.send({
        user: {
          id: user._id.toString(),
          mails: user.mails,
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
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return reply.send({ success: true });
  });
}
