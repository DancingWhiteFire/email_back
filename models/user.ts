// src/models/User.ts
import { Schema, model } from "mongoose";
import { UserModelType, EmailModelType } from "@/types/models/user";
import { PLAN_VALUES } from "@/constant/data";

const emailSchema = new Schema<EmailModelType>(
  {
    email: { type: String, required: true, unique: true },
    mailId: { type: String, required: true, unique: true },
    picture: { type: String },
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
          google: { type: emailSchema, default: null },
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
