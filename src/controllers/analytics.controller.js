const prisma = require("../lib/prisma");

const INVOICE_PAYMENT_TYPE = "invoice";
const TREND_DAYS = 14;
const TOP_PRODUCTS_DAYS = 90;
const TOP_PRODUCTS_LIMIT = 5;
const RECENT_ORDERS_LIMIT = 5;
const RECENT_LEADS_DAYS = 7;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Local calendar date, not toISOString()'s UTC one — the server runs ahead
// of UTC (Asia/Ulaanbaatar, +08:00), so a UTC-based key rolls "today" back
// to yesterday for roughly a third of the day.
function toDateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Admin-only: aggregate figures for the dashboard landing page — revenue,
// order volume, customer growth, outstanding invoices, best-selling products
// and a short daily revenue trend. Everything is derived from existing
// tables (no new schema), aggregated in JS the same way invoiceSummary does,
// since the shop's order volume doesn't warrant raw SQL.
async function dashboard(_req, res) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const trendStart = startOfDay(addDays(now, -(TREND_DAYS - 1)));
  const topProductsStart = addDays(now, -TOP_PRODUCTS_DAYS);
  const leadsStart = addDays(now, -RECENT_LEADS_DAYS);

  const notCancelled = { status: { not: "CANCELLED" } };

  const [
    revenueTotal,
    revenueToday,
    revenueThisMonth,
    revenueLastMonth,
    ordersTotal,
    ordersToday,
    ordersThisMonth,
    ordersByStatus,
    customersTotal,
    organizationsTotal,
    newCustomersThisMonth,
    invoicedAgg,
    paidAgg,
    recentOrders,
    trendOrders,
    topProductItems,
    corporateLeadsTotal,
    corporateLeadsRecent,
    contactMessagesTotal,
    contactMessagesRecent,
  ] = await Promise.all([
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: notCancelled }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { ...notCancelled, createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { ...notCancelled, createdAt: { gte: monthStart } } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { ...notCancelled, createdAt: { gte: lastMonthStart, lt: monthStart } },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { type: "ORGANIZATION" } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { paymentType: INVOICE_PAYMENT_TYPE, ...notCancelled },
    }),
    prisma.invoicePayment.aggregate({ _sum: { amount: true } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_ORDERS_LIMIT,
      select: {
        id: true,
        code: true,
        customerName: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        user: { select: { type: true, name: true, orgName: true } },
      },
    }),
    prisma.order.findMany({
      where: { ...notCancelled, createdAt: { gte: trendStart } },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { ...notCancelled, createdAt: { gte: topProductsStart } } },
      select: { qty: true, price: true, product: { select: { id: true, name: true } } },
    }),
    prisma.corporateLead.count(),
    prisma.corporateLead.count({ where: { createdAt: { gte: leadsStart } } }),
    prisma.contactMessage.count(),
    prisma.contactMessage.count({ where: { createdAt: { gte: leadsStart } } }),
  ]);

  const thisMonthSum = revenueThisMonth._sum.totalAmount || 0;
  const lastMonthSum = revenueLastMonth._sum.totalAmount || 0;
  const growthPct = lastMonthSum > 0 ? ((thisMonthSum - lastMonthSum) / lastMonthSum) * 100 : thisMonthSum > 0 ? 100 : 0;

  const statusCounts = Object.fromEntries(ordersByStatus.map((row) => [row.status, row._count._all]));

  // Fill every day in the window, including days with no orders, so the
  // trend chart has a continuous x-axis.
  const trendByDay = new Map();
  for (let i = 0; i < TREND_DAYS; i++) {
    trendByDay.set(toDateKey(addDays(trendStart, i)), { date: toDateKey(addDays(trendStart, i)), revenue: 0, orders: 0 });
  }
  for (const order of trendOrders) {
    const key = toDateKey(order.createdAt);
    const bucket = trendByDay.get(key);
    if (bucket) {
      bucket.revenue += order.totalAmount;
      bucket.orders += 1;
    }
  }

  const productTotals = new Map();
  for (const item of topProductItems) {
    if (!item.product) continue;
    const entry = productTotals.get(item.product.id) || { productId: item.product.id, name: item.product.name, qty: 0, revenue: 0 };
    entry.qty += item.qty;
    entry.revenue += item.price * item.qty;
    productTotals.set(item.product.id, entry);
  }
  const topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, TOP_PRODUCTS_LIMIT);

  const publicRecentOrders = recentOrders.map((order) => ({
    ...order,
    buyerLabel:
      order.user?.type === "ORGANIZATION"
        ? order.user.orgName || order.customerName || "—"
        : order.customerName || order.user?.name || "—",
  }));

  res.json({
    revenue: {
      total: revenueTotal._sum.totalAmount || 0,
      today: revenueToday._sum.totalAmount || 0,
      thisMonth: thisMonthSum,
      lastMonth: lastMonthSum,
      growthPct,
    },
    orders: {
      total: ordersTotal,
      today: ordersToday,
      thisMonth: ordersThisMonth,
      byStatus: statusCounts,
    },
    customers: {
      total: customersTotal,
      organizations: organizationsTotal,
      newThisMonth: newCustomersThisMonth,
    },
    invoices: {
      totalOwed: (invoicedAgg._sum.totalAmount || 0) - (paidAgg._sum.amount || 0),
    },
    revenueTrend: Array.from(trendByDay.values()),
    topProducts,
    recentOrders: publicRecentOrders,
    leads: {
      corporateLeadsTotal,
      corporateLeadsRecent,
      contactMessagesTotal,
      contactMessagesRecent,
    },
  });
}

module.exports = { dashboard };
