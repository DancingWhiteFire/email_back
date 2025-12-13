import { METHOD_VALUES } from "@/constant/data";
import { LogModelType } from "@/types/models/log";
import mongoose, { Schema, model } from "mongoose";

const loggersSchema = new Schema<LogModelType>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    method: {
      type: String,
      enum: Object.values(METHOD_VALUES),
      default: METHOD_VALUES.POST,
    },
    url: { type: String, required: true },
    ip: { type: String, required: true },
    country: { type: String, default: null },
    os: {
      type: new Schema({ system: String, version: String }, { _id: false }),
    },
    browser: {
      type: new Schema({ types: String, version: String }, { _id: false }),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Log = model<LogModelType>("Log", loggersSchema);
