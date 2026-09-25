const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const productsRoutes = require("./routes/products.routes");
const ordersRoutes = require("./routes/orders.routes");
const addressesRoutes = require("./routes/addresses.routes");
const categoriesRoutes = require("./routes/categories.routes");
const usersRoutes = require("./routes/users.routes");
const corporateLeadsRoutes = require("./routes/corporateLeads.routes");
const contactMessagesRoutes = require("./routes/contactMessages.routes");
const faqCategoriesRoutes = require("./routes/faqCategories.routes");
const faqsRoutes = require("./routes/faqs.routes");
const settingsRoutes = require("./routes/settings.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/addresses", addressesRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/corporate-leads", corporateLeadsRoutes);
app.use("/api/contact-messages", contactMessagesRoutes);
app.use("/api/faq-categories", faqCategoriesRoutes);
app.use("/api/faqs", faqsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
