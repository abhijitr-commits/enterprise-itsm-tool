const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const { requireLogin } = require("../middleware/auth");

// Open to any signed-in user, same tier as the Employee Directory and
// every other "read across records I can already see" screen — no
// dedicated permission key, matching the original's globalSearch()
// which had no requirePermission() call of its own either.
router.use(requireLogin);

router.get("/", searchController.showResults);

module.exports = router;
