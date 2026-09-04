const express = require("express");
const router = express.Router();
const requestController = require("../controllers/serviceRequestController");
const { hasPermission } = require("../utils/permissions");
const { isDelegatedApprover } = require("../utils/delegation");
const { requireLogin } = require("../middleware/auth");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

// Same as guard(), but also lets in a stand-in approval delegate —
// see utils/delegation.js. Only used for requests_approve, matching
// the original's isDelegatedApprover() scope exactly.
function guardOrDelegate(action) {
  return async (req, res, next) => {
    const allowed = (await hasPermission(req.user.role, action)) || (await isDelegatedApprover(req.user, action));
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/", requestController.listRequests);
router.get("/new", guard("requests_create"), requestController.showNewForm);
router.post("/", guard("requests_create"), requestController.createRequest);
router.post("/bulk-decide", guardOrDelegate("requests_approve"), requestController.bulkDecideRequests);
router.get("/:id", requestController.showRequest);
router.post("/:id", guard("requests_edit"), requestController.updateRequest);
router.post("/:id/decide", guardOrDelegate("requests_approve"), requestController.decideRequest);
router.post("/:id/close", guard("requests_close"), requestController.closeRequest);
router.post("/:id/comments", requestController.addComment);

module.exports = router;
