import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Links one canonical Station to one Project. A station may be linked to several projects.
 * `source_project_value` keeps the original Excel text ("under which work done/Proposed", col BB) that produced the link.
 * Anything that is genuinely project-specific (target, remarks, ...) belongs here, not on the station.
 */
const projectStationSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    station: { type: Schema.Types.ObjectId, ref: 'Station', required: true },
    relationship_type: { type: String, enum: ['primary', 'secondary'], default: 'primary' },
    source_project_value: { type: String, default: null },
    project_target_date: { type: String, default: null },
    project_remarks: { type: String, default: null, trim: true, maxlength: 500 },
    linked_at: { type: Date, required: true },
    linked_by: { type: String, default: 'Operator' },
  },
  { collection: 'project_stations', versionKey: false, timestamps: false },
);

projectStationSchema.index({ project: 1, station: 1 }, { unique: true });
projectStationSchema.index({ station: 1 });

export const ProjectStation = mongoose.models.ProjectStation || mongoose.model('ProjectStation', projectStationSchema);
