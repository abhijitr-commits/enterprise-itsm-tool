/*************************************************************
 * ecrController.js — Phase 10 addition. Engineering Change Requests:
 * a product/design revision workflow (Designing/Technical/Software/
 * Robotics/Electrical/Electronics), deliberately separate from
 * changeController.js's IT-infrastructure CAB changes — see
 * models/EngineeringChangeRequest.js. Same propose → decide shape as
 * Change's CAB approval (open create tier, Admin/Manager decide tier).
 *************************************************************/
const EngineeringChangeRequest = require("../models/EngineeringChangeRequest");
const { ECR_STATUS } = EngineeringChangeRequest;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");

async function listECRs(req, res) {
  const ecrs = await EngineeringChangeRequest.find().sort({ requestedDate: -1 }).lean();
  const canDecide = await hasPermission(req.user.role, "ecr_decide");

  res.render("engineering-changes/list", { ecrs, canDecide, ECR_STATUS, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("engineering-changes/new", { error: null, form: {} });
}

async function createECR(req, res) {
  try {
    const data = req.body;
    if (!data.title) throw new Error("Title is required.");
    if (!data.department) throw new Error("Department is required.");
    if (!data.description) throw new Error("Description is required.");

    const ecrId = await generateSequentialId("ECR");
    await EngineeringChangeRequest.create({
      ecrId,
      title: data.title,
      department: data.department,
      relatedAsset: data.relatedAsset || "",
      description: data.description,
      reason: data.reason || "",
      requestedBy: req.user.name,
    });

    await logAudit({ user: req.user._id, action: "Propose", entityType: "Engineering Change Request", details: `${data.department} — ${data.title}` });

    res.redirect(`/engineering-changes?message=${encodeURIComponent("Engineering Change Request Submitted")}`);
  } catch (err) {
    res.status(400).render("engineering-changes/new", { error: err.message, form: req.body });
  }
}

async function decideECR(req, res) {
  try {
    const { status, reviewNotes } = req.body;
    if (![ECR_STATUS.UNDER_REVIEW, ECR_STATUS.APPROVED, ECR_STATUS.REJECTED, ECR_STATUS.IMPLEMENTED].includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const ecr = await EngineeringChangeRequest.findById(req.params.id);
    if (!ecr) return res.status(404).render("errors/404");

    ecr.status = status;
    ecr.reviewedBy = req.user.name;
    if (reviewNotes) ecr.reviewNotes = reviewNotes;
    if (status === ECR_STATUS.APPROVED || status === ECR_STATUS.REJECTED) ecr.decidedDate = new Date();
    await ecr.save();

    await logAudit({ user: req.user._id, action: "Decision", entityType: "Engineering Change Request", entityId: ecr._id, details: status });

    res.redirect(`/engineering-changes?message=${encodeURIComponent(`ECR status updated to ${status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listECRs, showNewForm, createECR, decideECR };
