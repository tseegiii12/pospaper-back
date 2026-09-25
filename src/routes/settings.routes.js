const { Router } = require("express");
const { get, update } = require("../controllers/settings.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get("/", asyncHandler(get));
router.put("/", requireAuth, requireAdmin, asyncHandler(update));

module.exports = router;
