const prisma = require("../lib/prisma");
const { generateOrderCode } = require("../lib/orderCode");
const { parsePagination } = require("../utils/pagination");

// The one paymentType value that's gated by a permission (User.canInvoice)
// rather than being freely choosable. Everything else is stored as-is.
const INVOICE_PAYMENT_TYPE = "invoice";

// The structured address fields the checkout form collects, besides the
// composed `address` display string — mirrors Address's own field set (see
// schema.prisma) since a saved Address is really just a reusable snapshot
// of this same shape.
const ADDRESS_SNAPSHOT_FIELDS = [
  "addressType",
  "aimag",
  "district",
  "khoroo",
  "building",
  "unit",
  "houseNumber",
  "street",
  "officeBuilding",
  "floor",
  "officeUnit",
  "officeName",
  "addressNote",
];

// Resolves the address to snapshot onto the order: if addressId names one of
// the buyer's own saved addresses, its fields win (so editing the checkout
// form after picking a saved address without meaning to doesn't desync the
// order from what's actually on file); otherwise falls back to whatever
// structured fields came inline in the request body.
async function resolveAddressSnapshot(req) {
  const { addressId, address } = req.body;
  if (addressId) {
    const saved = await prisma.address.findUnique({ where: { id: addressId } });
    if (!saved || saved.userId !== req.user.id) {
      return { error: "Сонгосон хаяг олдсонгүй." };
    }
    const snapshot = { address: saved.fullAddress, addressId: saved.id };
    for (const field of ADDRESS_SNAPSHOT_FIELDS) snapshot[field] = saved[field];
    return { snapshot };
  }

  const snapshot = { address, addressId: undefined };
  for (const field of ADDRESS_SNAPSHOT_FIELDS) snapshot[field] = req.body[field] || undefined;
  return { snapshot };
}

async function create(req, res) {
  const { items, customerName, phone, altPhone, regNumber, paymentType } = req.body;

  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ error: "Холбоо барих утасны дугаар шаардлагатай." });
  }
  const { error: addressError, snapshot: addressSnapshot } = await resolveAddressSnapshot(req);
  if (addressError) return res.status(400).json({ error: addressError });
  if (!addressSnapshot.address || !String(addressSnapshot.address).trim()) {
    return res.status(400).json({ error: "Хүргэлтийн хаяг шаардлагатай." });
  }
  if (regNumber && !/^\d{7}$/.test(String(regNumber).trim())) {
    return res.status(400).json({ error: "Байгууллагын регистрийн дугаарыг 7 оронтой тоогоор оруулна уу." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Сагс хоосон байна." });
  }

  const trimmedPaymentType = paymentType ? String(paymentType).trim() : undefined;
  if (trimmedPaymentType?.toLowerCase() === INVOICE_PAYMENT_TYPE && !req.user.canInvoice) {
    return res.status(403).json({ error: "Танд нэхэмжлэхээр захиалга хийх эрх байхгүй байна." });
  }

  const productIds = items.map((i) => i.id);
  const optionIds = items.map((i) => i.optionId).filter(Boolean);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const options = optionIds.length
    ? await prisma.productOption.findMany({ where: { id: { in: optionIds } } })
    : [];
  const optionMap = new Map(options.map((o) => [o.id, o]));

  const orderItemsData = [];
  let totalAmount = 0;
  for (const item of items) {
    const product = productMap.get(item.id);
    if (!product || !product.active) {
      return res.status(400).json({ error: `Бүтээгдэхүүн олдсонгүй: ${item.id}` });
    }
    const qty = Math.max(1, Number(item.qty) || 1);

    // Price is always taken from the DB record, never trusted from the client.
    // If the item names a package option, that option's price wins and must
    // belong to the same product; otherwise fall back to the base product price.
    let price = product.unitPrice;
    let vatUnitPrice = product.unitPrice;
    let noVatUnitPrice = product.unitPriceNoVat;
    let optionId;
    if (item.optionId) {
      const option = optionMap.get(item.optionId);
      if (!option || option.productId !== product.id) {
        return res.status(400).json({ error: `Сонголт олдсонгүй: ${item.optionId}` });
      }
      price = option.pkgPrice;
      vatUnitPrice = option.unitPrice;
      noVatUnitPrice = option.unitPriceNoVat;
      optionId = option.id;
    }

    // The buyer can only choose between the VAT-inclusive and VAT-exclusive
    // rate the product already has on file — the no-VAT amount itself is
    // still derived from the DB's own unit prices, not sent by the client.
    let priceMode = "VAT";
    if (item.priceMode === "noVat" && noVatUnitPrice != null && vatUnitPrice) {
      price = Math.round(price * (noVatUnitPrice / vatUnitPrice));
      priceMode = "NO_VAT";
    }

    orderItemsData.push({ productId: product.id, optionId, qty, price, priceMode });
    totalAmount += price * qty;
  }

  // The code is unique per day-and-random-suffix; collisions are astronomically
  // unlikely but retried a few times rather than trusted blindly.
  let order;
  for (let attempt = 0; !order; attempt++) {
    try {
      order = await prisma.order.create({
        data: {
          code: generateOrderCode(),
          userId: req.user.id,
          customerName,
          phone,
          altPhone: altPhone ? String(altPhone).trim() || undefined : undefined,
          ...addressSnapshot,
          regNumber: regNumber ? String(regNumber).trim() : undefined,
          paymentType: trimmedPaymentType,
          totalAmount,
          items: { create: orderItemsData },
        },
        include: { items: { include: { product: true, option: true } } },
      });
    } catch (err) {
      if (err.code === "P2002" && err.meta?.target?.includes("code") && attempt < 5) continue;
      throw err;
    }
  }

  // Remember the delivery address so the next checkout can default to it.
  const finalAddress = addressSnapshot.address;
  if (finalAddress && finalAddress.trim() && finalAddress !== req.user.lastAddress) {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastAddress: finalAddress },
    });
  }

  res.status(201).json({ order });
}

const VALID_STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

// A buyer's own order history: optionally filtered by status, paginated since
// it grows unbounded over time.
async function listMine(req, res) {
  const { status } = req.query;
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const where = { userId: req.user.id };
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Статус буруу байна. Зөвшөөрөгдсөн: ${VALID_STATUSES.join(", ")}` });
    }
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { product: true, option: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);
  res.json({ orders, total, page, pageSize });
}

const VALID_PAID_STATUSES = ["paid", "unpaid", "invoice"];

// Admin listing: filter by status/paymentType/paidStatus and free-text search
// across the buyer's name, phone, reg number and order id, plus a createdAt
// date range; paginated since the order list grows unbounded.
async function listAll(req, res) {
  const { status, paymentType, paidStatus, q, from, to } = req.query;
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const where = {};
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Статус буруу байна. Зөвшөөрөгдсөн: ${VALID_STATUSES.join(", ")}` });
    }
    where.status = status;
  }
  if (paymentType) {
    where.paymentType = paymentType;
  }
  // paidStatus is about payment progress (paid / unpaid / on invoice), which
  // is orthogonal to paymentType (the method chosen at checkout, e.g. qpay).
  // "paid"/"unpaid" only make sense for directly-paid orders, since invoice
  // orders track payment through the InvoicePayment ledger instead. Accepts
  // a comma-separated list so e.g. "paid,invoice" shows both together.
  if (paidStatus) {
    const statuses = [...new Set(String(paidStatus).split(",").map((s) => s.trim()).filter(Boolean))];
    if (statuses.some((s) => !VALID_PAID_STATUSES.includes(s))) {
      return res
        .status(400)
        .json({ error: `Төлбөрийн байдал буруу байна. Зөвшөөрөгдсөн: ${VALID_PAID_STATUSES.join(", ")}` });
    }
    // Selecting every option is equivalent to no filter at all.
    if (statuses.length && statuses.length < VALID_PAID_STATUSES.length) {
      const clauses = statuses.map((s) =>
        s === "invoice"
          ? { paymentType: INVOICE_PAYMENT_TYPE }
          : { paymentType: { not: INVOICE_PAYMENT_TYPE }, isPaid: s === "paid" }
      );
      where.AND = [...(where.AND || []), { OR: clauses }];
    }
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  const trimmedQ = q ? String(q).trim() : "";
  if (trimmedQ) {
    where.OR = [
      { id: { equals: trimmedQ } },
      { code: { contains: trimmedQ } },
      { customerName: { contains: trimmedQ, mode: "insensitive" } },
      { phone: { contains: trimmedQ, mode: "insensitive" } },
      { regNumber: { contains: trimmedQ, mode: "insensitive" } },
      { user: { is: { orgName: { contains: trimmedQ, mode: "insensitive" } } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { product: true, option: true } }, user: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);
  const publicOrders = orders.map((order) => {
    if (!order.user) return order;
    const { passwordHash, ...publicUser } = order.user;
    return { ...order, user: publicUser };
  });
  res.json({ orders: publicOrders, total, page, pageSize });
}

// Admin-only: outstanding invoice balance per organization — totalInvoiced is
// the sum of every non-cancelled "invoice" (pay-later) order, totalPaid is
// every recorded payment against that org, and totalOwed nets the two. A
// payment isn't tied to a specific order, so it's just subtracted from the
// running total (can cover several orders, or be a partial amount).
async function invoiceSummary(req, res) {
  const { q } = req.query;
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const [orders, payments] = await Promise.all([
    prisma.order.findMany({
      where: { paymentType: INVOICE_PAYMENT_TYPE, status: { not: "CANCELLED" }, userId: { not: null } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoicePayment.findMany({ orderBy: { paidAt: "desc" } }),
  ]);

  const userIds = new Set([...orders.map((o) => o.userId), ...payments.map((p) => p.userId)]);
  const trimmedQ = q ? String(q).trim() : "";
  const users = userIds.size
    ? await prisma.user.findMany({
        where: {
          id: { in: [...userIds] },
          ...(trimmedQ
            ? {
                OR: [
                  { orgName: { contains: trimmedQ, mode: "insensitive" } },
                  { name: { contains: trimmedQ, mode: "insensitive" } },
                  { phone: { contains: trimmedQ, mode: "insensitive" } },
                  { regNumber: { contains: trimmedQ, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      })
    : [];

  const byUser = new Map();
  for (const user of users) {
    const { passwordHash, ...publicUser } = user;
    byUser.set(user.id, {
      user: publicUser,
      totalInvoiced: 0,
      totalPaid: 0,
      totalOwed: 0,
      orders: [],
      payments: [],
    });
  }

  for (const order of orders) {
    const entry = byUser.get(order.userId);
    if (!entry) continue;
    entry.totalInvoiced += order.totalAmount;
    entry.orders.push(order);
  }
  for (const payment of payments) {
    const entry = byUser.get(payment.userId);
    if (!entry) continue;
    entry.totalPaid += payment.amount;
    entry.payments.push(payment);
  }

  for (const entry of byUser.values()) {
    entry.totalOwed = entry.totalInvoiced - entry.totalPaid;
  }

  const fullSummary = Array.from(byUser.values()).sort((a, b) => b.totalOwed - a.totalOwed);
  const grandTotalOwed = fullSummary.reduce((sum, entry) => sum + entry.totalOwed, 0);
  const summary = fullSummary.slice(skip, skip + take);
  res.json({ summary, total: fullSummary.length, page, pageSize, grandTotalOwed });
}

// Shared by the admin per-org statement and the customer's own invoice view:
// every non-cancelled invoice order with its line items, plus payment history.
async function buildInvoiceStatement(user) {
  const [orders, payments] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id, paymentType: INVOICE_PAYMENT_TYPE, status: { not: "CANCELLED" } },
      include: { items: { include: { product: true, option: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoicePayment.findMany({ where: { userId: user.id }, orderBy: { paidAt: "desc" } }),
  ]);

  const totalInvoiced = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const { passwordHash, ...publicUser } = user;
  return {
    user: publicUser,
    totalInvoiced,
    totalPaid,
    totalOwed: totalInvoiced - totalPaid,
    orders,
    payments,
  };
}

// Admin-only: one organization's full invoice statement — every non-cancelled
// invoice order with its line items (what was bought), plus the payment
// history, so an admin can see exactly what's owed and why.
async function invoiceDetail(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй." });
  res.json(await buildInvoiceStatement(user));
}

// The signed-in buyer's own invoice statement — same shape as invoiceDetail,
// scoped to req.user so any account can check its own balance (an account
// with no invoice orders just gets back all zeros).
async function myInvoice(req, res) {
  res.json(await buildInvoiceStatement(req.user));
}

// Admin-only: records a payment an organization made toward its invoice
// balance. Not linked to a specific order — see invoiceSummary.
async function recordPayment(req, res) {
  const { amount, note, paidAt } = req.body;
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "Дүн 0-ээс их байх ёстой." });
  }

  let parsedPaidAt = new Date();
  if (paidAt) {
    parsedPaidAt = new Date(paidAt);
    if (Number.isNaN(parsedPaidAt.getTime())) {
      return res.status(400).json({ error: "Огноо буруу байна." });
    }
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй." });

  const payment = await prisma.invoicePayment.create({
    data: {
      userId: user.id,
      amount: Math.round(parsedAmount),
      note: note ? String(note).trim() || undefined : undefined,
      paidAt: parsedPaidAt,
    },
  });
  res.status(201).json({ payment });
}

async function getById(req, res) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true, option: true } }, user: true },
  });
  if (!order) return res.status(404).json({ error: "Захиалга олдсонгүй." });
  const isOwner = order.userId && order.userId === req.user.id;
  const isAdmin = req.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "Энэ захиалгыг харах эрхгүй." });
  }
  if (order.user) {
    const { passwordHash, ...publicUser } = order.user;
    order.user = publicUser;
  }
  res.json({ order });
}

async function updateStatus(req, res) {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Статус буруу байна. Зөвшөөрөгдсөн: ${VALID_STATUSES.join(", ")}` });
  }
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json({ order });
}

// Admin-only: marks a directly-paid order (e.g. QPay, cash) as paid/unpaid.
// Invoice (pay-later) orders track payment through the InvoicePayment ledger
// instead — see invoiceSummary/recordPayment — so isPaid isn't meaningful
// for them and is rejected here to avoid the two mechanisms disagreeing.
async function updatePaid(req, res) {
  const { isPaid } = req.body;
  if (typeof isPaid !== "boolean") {
    return res.status(400).json({ error: "isPaid логик утга байх ёстой." });
  }
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Захиалга олдсонгүй." });
  if (existing.paymentType === INVOICE_PAYMENT_TYPE) {
    return res
      .status(400)
      .json({ error: "Нэхэмжлэхийн захиалгын төлбөрийг эндээс бүртгэдэггүй." });
  }
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { isPaid },
  });
  res.json({ order });
}

module.exports = {
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
};
