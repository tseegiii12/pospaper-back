const { Router } = require("express");
const {
  requestRegisterOtp,
  verifyRegisterOtp,
  login,
  me,
  googleAuth,
  completeGoogleSignup,
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.post("/register/request-otp", authLimiter, asyncHandler(requestRegisterOtp));
router.post("/register/verify-otp", authLimiter, asyncHandler(verifyRegisterOtp));
router.post("/login", authLimiter, asyncHandler(login));
router.post("/google", authLimiter, asyncHandler(googleAuth));
router.post("/google/complete", authLimiter, asyncHandler(completeGoogleSignup));
router.get("/me", requireAuth, asyncHandler(me));

module.exports = router;
