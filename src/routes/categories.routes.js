const { Router } = require("express");
const { list, create, update, remove } = require("../controllers/categories.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get("/", asyncHandler(list));
router.post("/", requireAuth, requireAdmin, asyncHandler(create));
router.put("/:id", requireAuth, requireAdmin, asyncHandler(update));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(remove));

module.exports = router;
