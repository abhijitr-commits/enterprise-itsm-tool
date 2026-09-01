const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const { requireLogin } = require("../middleware/auth");

router.get("/", requireLogin, profileController.showMyProfile);

module.exports = router;
