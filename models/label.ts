// src/models/User.ts
import mongoose, { Schema, model } from "mongoose";
import { LabelModelType } from "@/types/models/label";

const labelSchema = new Schema<LabelModelType>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    labelId: { type: String, required: true },
    labelName: { type: String, required: true },
    textColor: { type: String, default: null },
    backgroundColor: { type: String, default: null },
    labelListVisibility: { type: String, default: null },
    messageListVisibility: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const Label = model<LabelModelType>("Label", labelSchema);
