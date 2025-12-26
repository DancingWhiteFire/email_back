import { PLAN_VALUES } from "@/constant/data";
import { Document } from "mongoose";

export interface EmailModelType extends Document {
  mailId: string;
  email: string;
  picture: string;
}

export interface GoogleMailType extends EmailModelType {
  accessToken: string | null;
  refreshToken: string | null;
  expiryDate: Date | null;
  scope: string | null;
  lastHistoryId: string | null;
}

export interface UserModelType extends Document {
  name: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
  mails: {
    google?: GoogleMailType | null;
    microsoft?: EmailModelType | null;
  };
  plan: (typeof PLAN_VALUES)[keyof typeof PLAN_VALUES];
}
