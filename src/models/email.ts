// src/models/Email.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IEmail extends Document {
  userId: Types.ObjectId;
  providerMsgId: string;
  threadId: string;
  subject: string;
  snippet: string;
  body: string;
  sender: string;
  receivedAt: Date;
  status: "inbox" | "archived" | "deleted" | "pinned";
}

const emailSchema = new Schema<IEmail>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    providerMsgId: { type: String, required: true },
    threadId: { type: String, required: true },
    subject: { type: String, required: true },
    snippet: { type: String, required: true },
    body: { type: String, required: true },
    sender: { type: String, required: true },
    receivedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["inbox", "archived", "deleted", "pinned"],
      default: "inbox",
    },
  },
  { timestamps: true }
);

export const Email = model<IEmail>("Email", emailSchema);
