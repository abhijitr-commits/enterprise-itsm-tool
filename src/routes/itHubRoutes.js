const express = require("express");
const router = express.Router();
const itHubController = require("../controllers/itHubController");
const { requireLogin } = require("../middleware/auth");

router.use(requireLogin);

router.get("/", itHubController.showHub);

module.exports = router;
