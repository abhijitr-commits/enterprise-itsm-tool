const express = require("express");
const router = express.Router();
const cmdbController = require("../controllers/cmdbController");
const { hasPermission } = require("../utils/permissions");
const { requireLogin } = require("../middleware/auth");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/", cmdbController.listCIs);
router.get("/graph", cmdbController.showGraph);
router.get("/new", guard("cmdb_create"), cmdbController.showNewForm);
router.post("/", guard("cmdb_create"), cmdbController.createCI);
router.post("/relationships/:relId/delete", guard("cmdb_edit"), cmdbController.deleteRelationship);
router.get("/:id", cmdbController.showCI);
router.get("/:id/impact", cmdbController.showImpact);
router.post("/:id", guard("cmdb_edit"), cmdbController.updateCI);
router.post("/:id/delete", guard("cmdb_delete"), cmdbController.deleteCI);
router.post("/:id/relationships", guard("cmdb_edit"), cmdbController.addRelationship);

module.exports = router;
