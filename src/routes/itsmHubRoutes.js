const express = require("express");
const router = express.Router();
const itsmHubController = require("../controllers/itsmHubController");
const { requireLogin } = require("../middleware/auth");

router.use(requireLogin);

router.get("/", itsmHubController.showHub);

module.exports = router;
