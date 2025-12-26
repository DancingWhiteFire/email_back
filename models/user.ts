import { Schema, model } from "mongoose";
import {
  UserModelType,
  EmailModelType,
  GoogleMailType,
} from "@/types/models/user";
import { PLAN_VALUES } from "@/constant/data";

const emailSchema = new Schema<EmailModelType>(
  {
    mailId: { type: String, required: true },
    email: { type: String, required: true },
    picture: { type: String, default: null },
  },
  { _id: false }
);

const googleMailSchema = new Schema<GoogleMailType>(
  {
    mailId: { type: String, required: true },
    email: { type: String, required: true },
    picture: { type: String, default: null },
    accessToken: { type: String, default: null },
    refreshToken: { type: String, default: null },
    expiryDate: { type: Date, default: null },
    scope: { type: String, default: null },
    lastHistoryId: { type: String, default: null },
  },
  { _id: false }
);

const userSchema = new Schema<UserModelType>(
  {
    name: { type: String, required: true },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    avatar: { type: String, default: null },
    mails: {
      type: new Schema(
        {
          google: { type: googleMailSchema, default: null },
          microsoft: { type: emailSchema, default: null },
        },
        { _id: false }
      ),
      default: {},
    },
    plan: {
      type: String,
      enum: Object.values(PLAN_VALUES),
      default: PLAN_VALUES.FREE,
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const User = model<UserModelType>("User", userSchema);
