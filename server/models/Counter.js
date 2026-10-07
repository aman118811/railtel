import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Atomic counters. `{ _id: 'stations', seq }` is the last serial number (S.N.) handed out. */
const counterSchema = new Schema(
  { _id: { type: String, required: true }, seq: { type: Number, required: true, default: 0 } },
  { collection: 'counters', versionKey: false },
);

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
