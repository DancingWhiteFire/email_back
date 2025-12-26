import * as dotenv from "dotenv";
dotenv.config();

import { z } from "zod";

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  COOKIE_SECRET: z.string().default("your-cookie-secret-change-in-production"),
  JWT_SECRET: z.string().default("your-jwt-secret-change-in-production"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  BACKEND_URL: z.string().default(" https://14e2e389e217.ngrok-free.app"),
  MONGODB_URI: z.string().optional(),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("4000"),
  OPENAI_KEY: z.string(),
});

const env = envSchema.parse(process.env);

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const COOKIE_SECRET = env.COOKIE_SECRET;
const JWT_SECRET = env.JWT_SECRET;
const FRONTEND_URL = env.FRONTEND_URL;
const BACKEND_URL = env.BACKEND_URL;
const MONGODB_URI = env.MONGODB_URI;
const PORT = env.PORT;
const OPENAI_KEY = env.OPENAI_KEY;

if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is not set in environment variables");
}

if (!GOOGLE_CLIENT_SECRET) {
  throw new Error("GOOGLE_CLIENT_SECRET is not set in environment variables");
}

export {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  COOKIE_SECRET,
  JWT_SECRET,
  FRONTEND_URL,
  BACKEND_URL,
  MONGODB_URI,
  PORT,
  OPENAI_KEY,
};
