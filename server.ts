// src/server.ts
import fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import * as dotenv from "dotenv";
import { connectDB } from "@/config/db.js";
import { authRoutes } from "@/routes/auth.js";
import { emailRoutes } from "@/routes/email.js";
import { aiRoutes } from "@/routes/ai.js";
import { taskRoutes } from "@/routes/task.js";

dotenv.config();

async function start() {
  const app = fastify({
    logger: true,
    trustProxy: true,
    bodyLimit: 1048576,
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", uptime: process.uptime() };
  });
  // Register cookie plugin (for httpOnly cookies)
  await app.register(cookie, {
    secret:
      process.env.COOKIE_SECRET || "your-cookie-secret-change-in-production",
  });

  // Register JWT plugin (for signing tokens)
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "your-jwt-secret-change-in-production",
    cookie: {
      cookieName: "access_token",
      signed: false,
    },
  });

  await app.register(cors, {
    origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is not set in .env");
    process.exit(1);
  }

  await connectDB(mongoUri);

  // Route registration with prefixes
  app.register(authRoutes, { prefix: "/auth" });
  app.register(emailRoutes, { prefix: "/emails" });
  app.register(aiRoutes, { prefix: "/ai" });
  app.register(taskRoutes, { prefix: "/tasks" });

  const port = Number(process.env.PORT) || 4000;
  const host = "0.0.0.0";

  await app.listen({ port, host });
  console.log(`🚀 Server listening on http://${host}:${port}`);
}

start();
