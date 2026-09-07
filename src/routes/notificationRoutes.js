const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { requireLogin } = require("../middleware/auth");

router.use(requireLogin);

router.get("/", notificationController.listNotifications);
router.post("/mark-all-read", notificationController.markAllReadAction);
router.post("/:id/read", notificationController.markOneReadAction);

module.exports = router;
