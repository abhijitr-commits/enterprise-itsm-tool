const express = require("express");
const router = express.Router();
const assetController = require("../controllers/assetController");
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

router.get("/", assetController.listAssets);
router.get("/new", guard("assets_create"), assetController.showNewForm);
router.post("/", guard("assets_create"), assetController.createAsset);
router.get("/:id", assetController.showAsset);
router.post("/:id", guard("assets_edit"), assetController.updateAsset);
router.post("/:id/issue", guard("assets_issue"), assetController.issueAsset);
router.post("/:id/return", guard("assets_issue"), assetController.returnAsset);
router.post("/:id/decommission", guard("assets_edit"), assetController.decommissionAsset);
router.post("/:id/maintenance", guard("assets_edit"), assetController.logMaintenance);

module.exports = router;
