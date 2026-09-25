const { Router } = require("express");
const multer = require("multer");
const {
  list,
  getById,
  listAdmin,
  getByIdAdmin,
  create,
  update,
  setVisibility,
  remove,
} = require("../controllers/products.controller");
const {
  upload: uploadImage,
  serve: serveImage,
  remove: removeImage,
} = require("../controllers/productImages.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const optionsRouter = require("./productOptions.routes");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Fixed admin paths must be registered before the "/:id" catch-all below.
router.get("/admin", requireAuth, requireAdmin, asyncHandler(listAdmin));
router.get("/admin/:id", requireAuth, requireAdmin, asyncHandler(getByIdAdmin));

// Image storage: served publicly so the storefront can render uploaded images;
// upload/delete are admin-only. Registered before "/:id" since they're
// multi-segment paths, but kept grouped with the other fixed paths for clarity.
router.get("/images/:imageId", asyncHandler(serveImage));
router.post("/images", requireAuth, requireAdmin, upload.single("image"), asyncHandler(uploadImage));
router.delete("/images/:imageId", requireAuth, requireAdmin, asyncHandler(removeImage));

router.get("/", asyncHandler(list));
router.get("/:id", asyncHandler(getById));
router.post("/", requireAuth, requireAdmin, asyncHandler(create));
router.put("/:id", requireAuth, requireAdmin, asyncHandler(update));
router.patch("/:id/visibility", requireAuth, requireAdmin, asyncHandler(setVisibility));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(remove));

router.use("/:productId/options", optionsRouter);

module.exports = router;
