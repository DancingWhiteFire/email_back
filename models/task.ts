import { Schema, model, Document, Types } from "mongoose";

export interface ITask extends Document {
  title: string;
  dueDate?: Date;
  status: "todo" | "in-progress" | "done";
  emailId?: Types.ObjectId;
  ownerId: Types.ObjectId;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ["todo", "in-progress", "done"],
      default: "todo",
    },
    emailId: { type: Schema.Types.ObjectId, ref: "Email" },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Task = model<ITask>("Task", taskSchema);
