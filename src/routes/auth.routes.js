const { Router } = require("express");
const { requestRegisterOtp, verifyRegisterOtp, login, me } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.post("/register/request-otp", asyncHandler(requestRegisterOtp));
router.post("/register/verify-otp", asyncHandler(verifyRegisterOtp));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));

module.exports = router;
