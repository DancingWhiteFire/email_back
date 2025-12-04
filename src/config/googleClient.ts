import * as dotenv from "dotenv";
dotenv.config();

import { OAuth2Client } from "google-auth-library";
import { z } from "zod";

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  // optional, you can override if you want a custom redirect
  GOOGLE_REDIRECT_URI: z.string().optional(),
  // you can also make this optional with a default
  BACKEND_URL: z.string().default("http://localhost:4000"),
});

const env = envSchema.parse(process.env);

const redirectUri =
  env.GOOGLE_REDIRECT_URI ?? `${env.BACKEND_URL}/auth/google/callback`;

export const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  redirectUri
);
