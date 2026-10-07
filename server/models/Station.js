import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One document per station.
 *
 * The identity/filter fields are real, typed columns (so they can be indexed, sorted and filtered).
 * `data` holds every form field keyed exactly as in shared/fields.js (that file is the single source of
 * truth for fields, formulas and validation), so adding a form field never needs a schema change.
 */
const stationSchema = new Schema(
  {
    sn: { type: Number, required: true, min: 1 }, // serial number, assigned by the server
    stn_code: { type: String, required: true, trim: true, uppercase: true },
    station_name: { type: String, required: true, trim: true },
    region: { type: String, enum: ['ER', 'NR', 'SR', 'WR'], default: 'NR', index: true }, // sheet tab; a region holds several zones
    zone: { type: String, required: true, trim: true },
    division: { type: String, default: null, trim: true },
    status: { type: String, default: null, trim: true },
    data: { type: Schema.Types.Mixed, default: {} },
    created_at: { type: Date, required: true },
    updated_at: { type: Date, required: true }, // also the optimistic-lock token
    updated_by: { type: String, default: 'Operator', trim: true },
    created_by: { type: String, default: null, trim: true },
    // Application-owned (never overwrites the sheet's own status fields; see LIFECYCLE in shared/fields.js).
    lifecycle: { type: String, default: null, trim: true },
    draft: { type: Boolean, default: false }, // incomplete record saved as a draft
    origin: { type: String, enum: ['excel_import', 'application'], default: 'application' },
  },
  { collection: 'stations', versionKey: false, minimize: false, timestamps: false },
);

// One canonical station per zone + code. Projects link to it through ProjectStation (never a copy).
stationSchema.index({ zone: 1, stn_code: 1 }, { unique: true });
stationSchema.index({ sn: 1 });
stationSchema.index({ division: 1 });
stationSchema.index({ status: 1 });
stationSchema.index({ lifecycle: 1 });

export const Station = mongoose.models.Station || mongoose.model('Station', stationSchema);
