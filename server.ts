// src/server.ts
import fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { connectDB } from "@/config/db";
import { authRoutes } from "@/routes/auth";
import { emailRoutes } from "@/routes/email";
import { aiRoutes } from "@/routes/ai";
import { taskRoutes } from "@/routes/task";
import { labelRoutes } from "@/routes/label.route";
import {
  COOKIE_SECRET,
  FRONTEND_URL,
  JWT_SECRET,
  MONGODB_URI,
  PORT,
} from "@/lib/env";
import { JwtPayload } from "@/types/token";
import { METHOD_VALUES } from "@/constant/data";

async function start() {
  const app = fastify({
    logger: false,
    trustProxy: false,
    bodyLimit: 1048576,
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", uptime: process.uptime() };
  });

  // Register cookie plugin (for httpOnly cookies)
  await app.register(cookie, {
    secret: COOKIE_SECRET,
  });

  // Register JWT plugin (for signing tokens)
  await app.register(jwt, {
    secret: JWT_SECRET,
    cookie: {
      cookieName: "access_token",
      signed: false,
    },
  });

  await app.register(cors, {
    origin: [FRONTEND_URL],
    methods: Object.values(METHOD_VALUES),
    credentials: true,
  });

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const decoded = await request.jwtVerify<JwtPayload>();
        request.user = decoded;
      } catch (err) {
        console.log({ err }, "JWT verification failed");
        return reply.code(401).send({ error: "Unauthorized" });
      }
    }
  );

  const mongoUri = MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is not set in .env");
    process.exit(1);
  }

  await connectDB(mongoUri);

  // Route registration with prefixes
  app.register(authRoutes, { prefix: "/auth" });
  app.register(emailRoutes, { prefix: "/emails" });
  app.register(labelRoutes, { prefix: "/labels" });
  app.register(aiRoutes, { prefix: "/ai" });
  app.register(taskRoutes, { prefix: "/tasks" });

  const port = PORT;
  const host = "0.0.0.0";

  await app.listen({ port, host });
  console.log(`🚀 Server listening on http://${host}:${port}`);
}

start();
