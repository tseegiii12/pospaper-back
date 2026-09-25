const { Router } = require("express");
const {
  create,
  listMine,
  listAll,
  invoiceSummary,
  invoiceDetail,
  myInvoice,
  recordPayment,
  getById,
  updateStatus,
  updatePaid,
} = require("../controllers/orders.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

// Checkout requires an account so every order is linked to a user.
router.post("/", requireAuth, asyncHandler(create));
router.get("/mine", requireAuth, asyncHandler(listMine));
router.get("/", requireAuth, requireAdmin, asyncHandler(listAll));
router.get("/invoices/summary", requireAuth, requireAdmin, asyncHandler(invoiceSummary));
router.get("/invoices/me", requireAuth, asyncHandler(myInvoice));
router.get("/invoices/:userId", requireAuth, requireAdmin, asyncHandler(invoiceDetail));
router.post("/invoices/:userId/payments", requireAuth, requireAdmin, asyncHandler(recordPayment));
router.get("/:id", requireAuth, asyncHandler(getById));
router.patch("/:id/status", requireAuth, requireAdmin, asyncHandler(updateStatus));
router.patch("/:id/paid", requireAuth, requireAdmin, asyncHandler(updatePaid));

module.exports = router;
