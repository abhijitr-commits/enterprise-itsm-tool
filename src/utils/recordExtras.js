/*************************************************************
 * recordExtras.js — shared read helpers used by every record-detail
 * page (Incident/Request/Problem/Change/Asset/CMDB) to show its
 * attachments and audit trail. Ports two pieces of RecordEngine.gs:
 *
 *  - getAttachmentsForRecord(id) <- AttachmentEngine.gs's
 *    getAttachmentsForRecord(recordId)
 *  - getAuditTrailForRecord(id) <- RecordEngine.gs's
 *    getAuditTrailForRecord(id), same oldest-first ordering. The
 *    original filtered the Audit Log sheet by a record-ID column
 *    match; here that's simply entityId, since AuditLog.entityId is
 *    already a per-record ObjectId written by every logAudit() call
 *    across the app.
 *************************************************************/
const Attachment = require("../models/Attachment");
const AuditLog = require("../models/AuditLog");

async function getAttachmentsForRecord(module, recordId) {
  return Attachment.find({ module, recordId }).sort({ uploadDate: 1 }).lean();
}

async function getAuditTrailForRecord(recordId) {
  return AuditLog.find({ entityId: recordId })
    .sort({ createdAt: 1 })
    .populate("user", "name")
    .lean();
}

module.exports = { getAttachmentsForRecord, getAuditTrailForRecord };
