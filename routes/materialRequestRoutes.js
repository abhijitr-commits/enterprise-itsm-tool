const express = require("express");
const router = express.Router();
const materialRequestController = require("../controllers/materialRequestController");
const { requireLogin } = require("../middleware/auth");
const { hasPermission } = require("../utils/permissions");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/", materialRequestController.listMaterialRequests);
router.get("/new", guard("material_requests_submit"), materialRequestController.showNewForm);
router.post("/", guard("material_requests_submit"), materialRequestController.submitRequest);
router.post("/:id/issue", guard("material_requests_issue"), materialRequestController.issueRequest);
router.post("/:id/reject", guard("material_requests_issue"), materialRequestController.rejectRequest);

module.exports = router;
