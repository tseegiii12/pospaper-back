const { Router } = require("express");
const {
  listUsers,
  listOrganizations,
  createOrganization,
  setCanInvoice,
  setPassword,
} = require("../controllers/users.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.get("/", requireAuth, requireAdmin, asyncHandler(listUsers));
router.get("/organizations", requireAuth, requireAdmin, asyncHandler(listOrganizations));
router.post("/organizations", requireAuth, requireAdmin, asyncHandler(createOrganization));
router.patch("/:id/can-invoice", requireAuth, requireAdmin, asyncHandler(setCanInvoice));
router.patch("/:id/password", requireAuth, requireAdmin, asyncHandler(setPassword));

module.exports = router;
