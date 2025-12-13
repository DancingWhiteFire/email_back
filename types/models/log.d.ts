import { METHOD_VALUES } from "@/constant/data";
import mongoose, { Document } from "mongoose";

export interface LogModelType extends Document {
  ip: string;
  country: string | null;
  os: {
    system: string;
    version: string | null;
  };
  browser: {
    types: string;
    version: string | null;
  };
  method: (typeof METHOD_VALUES)[keyof typeof METHOD_VALUES];
  url: string;
  userId: {
    type: mongoose.Schema.Types.ObjectId;
    ref: "User";
    default: null;
  };
}
