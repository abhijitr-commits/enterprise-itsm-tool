const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Certificates" sheet (LMSEngine.gs):
 * Certificate ID | Employee | Course Title | Enrollment ID | Issued Date.
 * Not a PDF — a record rendered as a printable page (views/training/certificate.ejs)
 * the employee can print/save-as-PDF via their browser, same as the original.
 */
const certificateSchema = new mongoose.Schema(
  {
    certificateId: { type: String, unique: true, index: true }, // CERT-YYYY-000001
    employee: { type: String, required: true, trim: true },
    courseTitle: { type: String, trim: true },
    enrollmentId: { type: String, trim: true },
  },
  { timestamps: { createdAt: "issuedDate", updatedAt: false } }
);

certificateSchema.index({ employee: 1 });

module.exports = mongoose.model("Certificate", certificateSchema);
