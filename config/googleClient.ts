import { OAuth2Client, LoginTicket } from "google-auth-library";
import { BACKEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "@/lib/env";
import { google, gmail_v1 } from "googleapis";
import type { UserModelType } from "@/types/models/user";

export const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export const verifyGoogleIdToken = async (idToken: string) => {
  const ticket = (await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  })) as unknown as LoginTicket;

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Invalid Google ID token payload");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
};

export const createGoogleOAuthClient = () => {
  const GOOGLE_REDIRECT_URI = `${BACKEND_URL}/auth/google/callback`;

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
};

export async function getUserGmailClient(
  user: UserModelType
): Promise<gmail_v1.Gmail> {
  if (!user.mails.google?.accessToken)
    throw new Error("User has not connected Gmail");

  const oauth2Client = createGoogleOAuthClient();
  oauth2Client.setCredentials({
    access_token: user.mails.google?.accessToken,
    refresh_token: user.mails.google?.refreshToken ?? null,
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token)
      user.mails.google!.accessToken = tokens.access_token;
    if (tokens.refresh_token)
      user.mails.google!.refreshToken = tokens.refresh_token;
    if (tokens.expiry_date)
      user.mails.google!.expiryDate = new Date(tokens.expiry_date);
    await user.save();
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
