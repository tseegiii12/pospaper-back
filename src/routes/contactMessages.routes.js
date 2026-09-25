const { Router } = require("express");
const { create, list } = require("../controllers/contactMessages.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.post("/", asyncHandler(create));
router.get("/", requireAuth, requireAdmin, asyncHandler(list));

module.exports = router;
