import type { FastifyInstance } from "fastify";
import { verifyGoogleIdToken } from "@/config/googleClient";
import { User } from "@/models/user.js";
import { GoogleLoginBodyType } from "@/types/routes/auth";
import { JwtPayload } from "@/types/token";
import { attachClientInfo } from "@/middleware/ipdetect.middleware";
import { botCheck } from "@/middleware/botCheck";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: GoogleLoginBodyType }>("/google", async (req, reply) => {
    const { credential } = req.body;
    if (!credential)
      return reply.code(400).send({ error: "Missing credential" });

    try {
      const googleUser = await verifyGoogleIdToken(credential);
      let user = await User.findOne({
        "mails.google.email": googleUser.email,
      });
      console.log("Google user info:", user, googleUser);
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

      const token = fastify.jwt.sign(payload, { expiresIn: "1d" });

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

  fastify.post(
    "/logout",
    { preHandler: [attachClientInfo] },
    async (request, reply) => {
      console.log("logout");
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
