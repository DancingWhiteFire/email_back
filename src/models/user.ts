// src/models/User.ts
import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  plan: "free" | "pro" | "team";
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    plan: { type: String, enum: ["free", "pro", "team"], default: "free" },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const User = model<IUser>("User", userSchema);
