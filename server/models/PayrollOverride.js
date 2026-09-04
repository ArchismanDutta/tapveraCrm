// models/PayrollOverride.js
//
// What a human changed on the payroll register, for one employee and one month.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
//
// Every figure on the register is derived: salary comes from the employee
// record, days and paid days from the attendance summary, and everything else
// is calculated from those. Derived is right — it is what stops the register
// and the payslip disagreeing — but it also means an admin's correction lived
// only in the browser. Editing paid days from 16.5 to 21 and then reloading,
// changing month, or walking away for ten minutes put 16.5 straight back, with
// no warning that the correction had been thrown away.
//
// A correction to paid days IS somebody's pay, so it cannot be browser state.
// It is stored here, attributed, and merged back over the derived figures the
// next time the register is built.
//
// ─────────────────────────────────────────────────────────────────────────────
// ONLY THE FIELDS THAT WERE ACTUALLY CHANGED
//
// `inputs` holds the overridden fields and nothing else. A row that overrides
// only paidDays still follows the employee record if their salary changes, and
// still follows attendance for late days. Storing a whole row would silently
// freeze figures nobody meant to freeze — the first salary revision after an
// unrelated correction would be ignored, and nothing on screen would say so.
//
// Clearing an override deletes the field (or the document), and the row goes
// back to being derived.

"use strict";

const mongoose = require("mongoose");

// The only fields an admin can override, mirroring the register's editable
// cells. Anything else on the row is calculated and has no business here.
const OVERRIDABLE = [
  "days",
  "paidDays",
  "salary",
  "pfEligible",
  "esiEligible",
  "tds",
  "late",
  "other",
  "advance",
];

const PayrollOverrideSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /** "YYYY-MM" — the same key Payslip uses. */
    payPeriod: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
      index: true,
    },

    /**
     * Overridden fields only. Mixed because the set is small, fixed and
     * validated on the way in (see sanitiseInputs) — a sub-schema here would
     * store a default for every field and destroy the distinction between
     * "overridden to 0" and "not overridden".
     */
    inputs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /** Who last changed it. This moves money; it is attributable. */
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedByName: { type: String, default: "" },

    /** Free text, for the rare correction that needs explaining. */
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

// One override document per employee per month.
PayrollOverrideSchema.index({ employee: 1, payPeriod: 1 }, { unique: true });

/**
 * Keep only recognised fields, coerced to the right type.
 *
 * The register posts whatever the admin typed. Numbers arrive as strings, and
 * an empty string means "stop overriding this field" rather than zero — the
 * difference between a paid-days override of 0 and no override at all is a
 * whole month's pay.
 *
 * @param {Object} raw
 * @returns {{inputs: Object, cleared: string[]}}
 */
PayrollOverrideSchema.statics.sanitiseInputs = function (raw = {}) {
  const inputs = {};
  const cleared = [];

  for (const field of OVERRIDABLE) {
    if (!(field in raw)) continue;

    const value = raw[field];

    if (value === null || value === "") {
      cleared.push(field);
      continue;
    }

    if (field === "pfEligible" || field === "esiEligible") {
      inputs[field] = value === true || value === "true" || value === "Y";
      continue;
    }

    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    inputs[field] = n;
  }

  return { inputs, cleared };
};

PayrollOverrideSchema.statics.OVERRIDABLE = OVERRIDABLE;

module.exports = mongoose.model("PayrollOverride", PayrollOverrideSchema);
