const mongoose = require("mongoose");

/**
 * One collection standing in for the original's four near-identical
 * sheets (Onboarding Checklist, Offboarding Checklist, Admin Onboarding
 * Checklist, Admin Offboarding Checklist — all created via the same
 * ensureChecklistSheet(sheetName) helper in OnboardingEngine.gs). A
 * `type` discriminator replaces "which sheet", same columns otherwise:
 * Employee | Department | Task | Category | Status | Due Date | Completed Date.
 */
const CHECKLIST_TYPE = {
  ONBOARDING: "Onboarding",
  OFFBOARDING: "Offboarding",
  ADMIN_ONBOARDING: "Admin Onboarding",
  ADMIN_OFFBOARDING: "Admin Offboarding",
};

const checklistItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(CHECKLIST_TYPE), required: true },
    employee: { type: String, required: true, trim: true }, // employee (or candidate) name
    department: { type: String, trim: true },
    task: { type: String, required: true, trim: true },
    category: { type: String, trim: true }, // e.g. "Day 1", "Week 1", "Month 1", "Pre-Exit"
    status: { type: String, enum: ["Pending", "Done"], default: "Pending" },
    dueDate: { type: Date },
    completedDate: { type: Date },
  },
  { timestamps: true }
);

checklistItemSchema.index({ type: 1, employee: 1 });

module.exports = mongoose.model("ChecklistItem", checklistItemSchema);
module.exports.CHECKLIST_TYPE = CHECKLIST_TYPE;
