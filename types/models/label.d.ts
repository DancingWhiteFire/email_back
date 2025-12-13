import mongoose, { Document } from "mongoose";

export interface LabelModelType extends Document {
  userId: {
    type: mongoose.Schema.Types.ObjectId;
    ref: "User";
    default: null;
  };
  labelName: string;
  labelId: string;
  textColor: string | null;
  backgroundColor: string | null;
  labelListVisibility: string | null;
  messageListVisibility: string | null;
}
