// src/config/googleClient.ts
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // optional: if not set, we derive from BACKEND_URL
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  BACKEND_URL: z.string().url().optional(),
});

const env = envSchema.parse(process.env);

let redirectUri = env.GOOGLE_REDIRECT_URI;
if (!redirectUri) {
  const baseUrl = env.BACKEND_URL ?? "http://localhost:4000";
  redirectUri = `${baseUrl}/auth/google/callback`;
}

export const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  redirectUri
);
