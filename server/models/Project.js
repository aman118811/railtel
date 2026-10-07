import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PROJECT_TYPES = ['VSS', 'Nirbhaya', 'Combined / Multi-Project', 'Other'];
export const PROJECT_STATUSES = ['Planned', 'Active', 'On Hold', 'Completed', 'Closed'];

/** A project is a first-class record. Stations are linked to it through ProjectStation (never copied). */
const projectSchema = new Schema(
  {
    region: { type: String, enum: ['ER', 'NR', 'SR', 'WR'], default: 'NR' },
    code: { type: String, default: null, trim: true, uppercase: true, maxlength: 30 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: PROJECT_TYPES, default: 'Other' },
    description: { type: String, default: null, trim: true, maxlength: 1000 },
    executing_agency: { type: String, default: null, trim: true, maxlength: 160 },
    scope_description: { type: String, default: null, trim: true, maxlength: 1000 },
    status: { type: String, enum: PROJECT_STATUSES, default: 'Active' },
    start_date: { type: String, default: null }, // YYYY-MM-DD
    target_completion_date: { type: String, default: null },
    approved_station_count: { type: Number, default: null, min: 0 },
    approved_camera_scope: { type: Number, default: null, min: 0 },
    remarks: { type: String, default: null, trim: true, maxlength: 1000 },
    // The exact Excel "under which work done/Proposed" texts that map to this project (kept for traceability).
    source_values: { type: [String], default: [] },
    created_at: { type: Date, required: true },
    updated_at: { type: Date, required: true }, // optimistic-lock token
    created_by: { type: String, default: 'Operator', trim: true },
    updated_by: { type: String, default: 'Operator', trim: true },
  },
  { collection: 'projects', versionKey: false, timestamps: false },
);

projectSchema.index({ region: 1, name: 1 }, { unique: true });
projectSchema.index({ region: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } });

export const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
