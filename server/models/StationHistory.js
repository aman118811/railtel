import mongoose from 'mongoose';

const { Schema } = mongoose;

/** One document per saved change: who, when, and a field-level before/after diff. */
const historySchema = new Schema(
  {
    station_id: { type: Schema.Types.ObjectId, ref: 'Station', required: true },
    action: { type: String, enum: ['create', 'update'], required: true },
    changed_by: { type: String, default: 'Operator', trim: true },
    changed_at: { type: Date, required: true },
    changes: { type: Schema.Types.Mixed, default: {} }, // { field: { from, to } }
  },
  { collection: 'station_history', versionKey: false, minimize: false, timestamps: false },
);

historySchema.index({ station_id: 1, changed_at: -1 });

export const StationHistory = mongoose.models.StationHistory || mongoose.model('StationHistory', historySchema);
