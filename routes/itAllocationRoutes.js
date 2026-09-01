const express = require("express");
const router = express.Router();
const itAllocationController = require("../controllers/itAllocationController");
const { requireLogin } = require("../middleware/auth");
const { requireITTeam } = require("../utils/teamAccess");

router.use(requireLogin);
router.use(requireITTeam);

router.get("/", itAllocationController.listAllocations);
router.get("/new", itAllocationController.showAllocateForm);
router.post("/", itAllocationController.allocateAssets);

module.exports = router;
