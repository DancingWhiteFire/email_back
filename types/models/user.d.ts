import { Document } from "mongoose";

export type PlanType = "free" | "pro" | "team";

export interface UserModelType extends Document {
  name: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
  mails: {
    google?: EmailSubdoc | null;
    microsoft?: EmailSubdoc | null;
  };
  plan: PlanType;
}

export interface EmailModelType extends Document {
  mailId: string;
  email: string;
  picture?: string;
}
