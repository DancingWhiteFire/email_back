import * as dotenv from "dotenv";
dotenv.config();

import { OAuth2Client, LoginTicket } from "google-auth-library";
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

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is not set in environment variables");
}

export const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken: string) {
  const ticket = (await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  })) as unknown as LoginTicket;

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Invalid Google ID token payload");
  }

  return {
    googleId: payload.sub, // unique per Google user
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}
