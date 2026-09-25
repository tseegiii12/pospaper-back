const { Router } = require("express");
const { dashboard } = require("../controllers/analytics.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get("/dashboard", requireAuth, requireAdmin, asyncHandler(dashboard));

module.exports = router;
