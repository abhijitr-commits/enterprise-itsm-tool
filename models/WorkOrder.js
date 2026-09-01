const mongoose = require("mongoose");

/**
 * Phase 10 addition — no equivalent in the original. A single Work
 * Order model deliberately covers every hands-on-hardware department
 * named by the company (Production, Robotics, Electrical, Electronics,
 * Technical, Software) via a plain `department` field — same pattern
 * as Incident.department, governed by the existing Master Data
 * "Departments" table rather than a hardcoded enum, so Admin can add
 * or rename departments without a code change. One model instead of
 * six near-identical ones, matching this app's own precedent
 * (Checklist.js collapsing 4 sheets into one via a `type` field).
 */
const WORK_ORDER_STATUS = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  QC: "Quality Check",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
};

const workOrderSchema = new mongoose.Schema(
  {
    workOrderId: { type: String, unique: true, index: true }, // WO-YYYY-000001

    department: { type: String, required: true, trim: true }, // Production/Robotics/Electrical/Electronics/Technical/Software/...
    relatedSalesOrder: { type: String, trim: true }, // optional — SalesOrder.salesOrderId, plain-string link
    relatedAsset: { type: String, trim: true }, // optional — the robot/equipment being built or serviced, same link convention as Incident.relatedAsset

    itemDescription: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1 },
    status: { type: String, enum: Object.values(WORK_ORDER_STATUS), default: WORK_ORDER_STATUS.NOT_STARTED },
    assignedTo: { type: String, trim: true },
    startDate: { type: Date },
    targetCompletionDate: { type: Date },
    completedDate: { type: Date },
    defectNotes: { type: String, trim: true }, // QC findings / rework notes

    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

workOrderSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model("WorkOrder", workOrderSchema);
module.exports.WORK_ORDER_STATUS = WORK_ORDER_STATUS;
