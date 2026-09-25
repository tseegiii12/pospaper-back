const { Router } = require("express");
const { list, create, update, remove } = require("../controllers/addresses.controller");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

// A buyer's saved address book — every route is scoped to req.user inside
// the controller, no admin access needed.
router.get("/", requireAuth, asyncHandler(list));
router.post("/", requireAuth, asyncHandler(create));
router.put("/:id", requireAuth, asyncHandler(update));
router.delete("/:id", requireAuth, asyncHandler(remove));

module.exports = router;
