/*************************************************************
 * apiRoutes.js — Architecture Phase 4: the Integration API,
 * mounted at /api/v1 in server.js. Every route here is gated by
 * requireApiToken() (utils/apiAuth.js) instead of the session-based
 * requireLogin() every other route in this app uses — this is for
 * OTHER SYSTEMS to call (a monitoring tool, a website contact form,
 * a CI pipeline), not a signed-in browser, so there's no session to
 * check. See views/admin/integrations.ejs for where an Administrator
 * turns this on and gets the key.
 *************************************************************/
const express = require("express");
const router = express.Router();
const apiController = require("../controllers/apiController");
const { requireApiToken } = require("../utils/apiAuth");

router.use(requireApiToken());

router.post("/incidents", apiController.createIncidentApi);
router.get("/incidents", apiController.listIncidentsApi);
router.get("/incidents/:incidentId", apiController.getIncidentApi);

router.post("/requests", apiController.createServiceRequestApi);
router.post("/problems", apiController.createProblemApi);
router.post("/changes", apiController.createChangeApi);

module.exports = router;
