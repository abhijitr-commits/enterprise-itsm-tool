/*************************************************************
 * helpdeskController.js — port of ITHelpdeskEngine.gs.
 *
 * A focused work queue for the IT team — reuses the EXISTING
 * Incident and Service Request data (doesn't duplicate the ticketing
 * engine), just surfaces it filtered and prioritized specifically for
 * IT staff to triage quickly, then links straight through to the real
 * modules for action.
 *************************************************************/
const Incident = require("../models/Incident");
const ServiceRequest = require("../models/ServiceRequest");

async function showHelpdesk(req, res) {
  const [incidents, requests] = await Promise.all([
    Incident.find().lean(),
    ServiceRequest.find().lean(),
  ]);

  const openIncidents = incidents.filter((i) => i.status !== "Closed" && i.status !== "Resolved");
  const pendingRequests = requests.filter((r) => r.fulfillmentStatus !== "Closed");

  res.render("helpdesk/index", {
    summary: {
      openCount: openIncidents.length,
      criticalCount: openIncidents.filter((i) => i.priority === "Critical").length,
      unassignedCount: openIncidents.filter((i) => !i.engineer).length,
      pendingRequestsCount: pendingRequests.length,
    },
  });
}

module.exports = { showHelpdesk };
