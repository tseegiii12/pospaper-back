const { Router } = require("express");
const { list, create, update, remove } = require("../controllers/productOptions.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router({ mergeParams: true });

router.get("/", asyncHandler(list));
router.post("/", requireAuth, requireAdmin, asyncHandler(create));
router.put("/:optionId", requireAuth, requireAdmin, asyncHandler(update));
router.delete("/:optionId", requireAuth, requireAdmin, asyncHandler(remove));

module.exports = router;
