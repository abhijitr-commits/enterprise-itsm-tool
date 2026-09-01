/*************************************************************
 * myWorkController.js — port of MyWorkEngine.gs. "My Tickets":
 * incidents/requests where I'm the reporter/requester OR the
 * assigned engineer. "My Approvals": pending Service Requests and
 * Changes I can actually act on given my role (Leave approvals will
 * join this list once Phase 4B's Leave module exists).
 *
 * Matching is by name (req.user.name), same limitation the
 * original had matching by name via the Users sheet — a name
 * mismatch between your login and a ticket's free-typed name field
 * means it won't show up here.
 *************************************************************/
const Incident = require("../models/Incident");
const ServiceRequest = require("../models/ServiceRequest");
const Change = require("../models/Change");
const { hasPermission } = require("../utils/permissions");
const { STATUS } = require("../config/constants");

async function showMyWork(req, res) {
  const myName = req.user.name;
  const nameRx = new RegExp(`^${myName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  const [myIncidents, myRequests, canApproveRequests, canApproveChanges] = await Promise.all([
    Incident.find({ $or: [{ employeeName: nameRx }, { engineer: nameRx }] }).sort({ createdDate: -1 }).lean(),
    ServiceRequest.find({ requester: nameRx }).sort({ createdDate: -1 }).lean(),
    hasPermission(req.user.role, "requests_approve"),
    hasPermission(req.user.role, "changes_approve"),
  ]);

  const [pendingRequests, pendingChanges] = await Promise.all([
    canApproveRequests ? ServiceRequest.find({ approvalStatus: ServiceRequest.APPROVAL.PENDING }).lean() : [],
    canApproveChanges ? Change.find({ cabStatus: ServiceRequest.APPROVAL.PENDING }).lean() : [],
  ]);

  const openIncidents = myIncidents.filter((i) => i.status !== STATUS.CLOSED && i.status !== STATUS.RESOLVED).length;
  const openRequests = myRequests.filter((r) => r.fulfillmentStatus !== STATUS.CLOSED).length;

  res.render("mywork/index", {
    myIncidents,
    myRequests,
    pendingRequests,
    pendingChanges,
    snapshot: {
      name: myName,
      openIncidents,
      openRequests,
      totalIncidents: myIncidents.length,
      totalRequests: myRequests.length,
    },
  });
}

module.exports = { showMyWork };
