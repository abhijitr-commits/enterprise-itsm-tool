const express = require("express");
const router = express.Router();
const knowledgeController = require("../controllers/knowledgeController");
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

router.get("/", knowledgeController.listArticles);
router.get("/new", guard("knowledge_create"), knowledgeController.showNewForm);
router.post("/", guard("knowledge_create"), knowledgeController.createArticle);
router.get("/:id", knowledgeController.showArticle);
router.post("/:id", guard("knowledge_edit"), knowledgeController.updateArticle);

module.exports = router;
