import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Audit trail for projects and for project <-> station links (station field edits stay in station_history). */
const projectHistorySchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    station: { type: Schema.Types.ObjectId, ref: 'Station', default: null },
    action: { type: String, enum: ['create', 'update', 'link', 'unlink'], required: true },
    changed_by: { type: String, required: true },
    changed_at: { type: Date, required: true },
    changes: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: 'project_history', versionKey: false, minimize: false, timestamps: false },
);

projectHistorySchema.index({ project: 1, changed_at: -1 });
projectHistorySchema.index({ station: 1, changed_at: -1 });

export const ProjectHistory = mongoose.models.ProjectHistory || mongoose.model('ProjectHistory', projectHistorySchema);
