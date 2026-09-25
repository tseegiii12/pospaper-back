// One-off script to fill the dev database with realistic test products +
// package-size options, covering the 4 real thermal paper sizes the user
// gave pricing for. Safe to re-run: upserts by a fixed slug id.
//
// Usage: node scripts/seed-test-products.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CATEGORY_ID = "14bb451a-1555-4815-a83b-816c7c4d4037"; // "POS-ийн цаас" (existing category)

const round = (n) => Math.round(n);

// Each entry: the four real prices the user gave, plus enough copy to look
// like a real catalog row. Options exercise the unitsFrom/unitsTo range
// feature: a standard 50-100 box tier, and a discounted 101-200 bulk tier.
const testProducts = [
  {
    slug: "test-80x80",
    imgTag: "80 × 80 мм",
    name: "POS цаас 80 × 80 мм",
    tag: "Супермаркет",
    tagClass: "text-orange-600",
    stockBadge: "🟢 Бэлэн байна",
    description: "Супермаркет сүлжээ, ТҮЦ, дугаар олгогч, АТМ киоск зориулалттай 80×80мм термал цаас.",
    marketPrice: 3850,
    unitPrice: 2500,
    unitPriceNoVat: 2250,
    recommended: true,
    highlight: true,
  },
  {
    slug: "test-57x50",
    imgTag: "57 × 50 мм",
    name: "POS цаас 57 × 50 мм",
    tag: "Android POS",
    tagClass: "text-blue-600",
    stockBadge: "🟢 Бэлэн байна",
    description: "Ухаалаг Android ПОС, Sunmi V2, таксиметр, гар принтерт тохирох 57×50мм термал цаас.",
    marketPrice: 1667,
    unitPrice: 1200,
    unitPriceNoVat: 1080,
    recommended: true,
    highlight: false,
  },
  {
    slug: "test-80x60",
    imgTag: "80 × 60 мм",
    name: "POS цаас 80 × 60 мм",
    tag: "Кассын принтер",
    tagClass: "text-orange-600",
    stockBadge: "🟢 Бэлэн байна",
    description: "Суурин касс, ресторан, кафе шоп, бар хүлээн авагчид зориулсан 80×60мм термал цаас.",
    marketPrice: 1815,
    unitPrice: 1650,
    unitPriceNoVat: 1500,
    recommended: false,
    highlight: false,
  },
  {
    slug: "test-57x40",
    imgTag: "57 × 40 мм",
    name: "POS цаас 57 × 40 мм",
    tag: "Гар POS",
    tagClass: "text-blue-600",
    stockBadge: "🟢 Бэлэн байна",
    description: "Банкны гар терминал, ХААН/Голомт гар ПОС төхөөрөмжүүдэд зориулсан 57×40мм термал цаас.",
    marketPrice: 1000,
    unitPrice: 880,
    unitPriceNoVat: 800,
    recommended: false,
    highlight: false,
  },
];

async function upsertProduct(p) {
  const product = await prisma.product.upsert({
    where: { id: p.slug },
    update: {
      name: p.name,
      description: p.description,
      tag: p.tag,
      tagClass: p.tagClass,
      imgTag: p.imgTag,
      stockBadge: p.stockBadge,
      marketPrice: p.marketPrice,
      unitPrice: p.unitPrice,
      unitPriceNoVat: p.unitPriceNoVat,
      recommended: p.recommended,
      highlight: p.highlight,
      categories: { set: [{ id: CATEGORY_ID }] },
    },
    create: {
      id: p.slug,
      name: p.name,
      description: p.description,
      tag: p.tag,
      tagClass: p.tagClass,
      imgTag: p.imgTag,
      stockBadge: p.stockBadge,
      marketPrice: p.marketPrice,
      unitPrice: p.unitPrice,
      unitPriceNoVat: p.unitPriceNoVat,
      recommended: p.recommended,
      highlight: p.highlight,
      categories: { connect: [{ id: CATEGORY_ID }] },
    },
  });

  // Two package tiers per product: a standard 50-100 box, and a 101-200
  // bulk tier at a 5% discount — gives real data to exercise the
  // unitsFrom/unitsTo range option UI.
  const tiers = [
    {
      unitsFrom: 50,
      unitsTo: 100,
      label: "50-100ш багц",
      unitPrice: p.unitPrice,
      marketPrice: p.marketPrice,
      unitPriceNoVat: p.unitPriceNoVat,
      isDefault: true,
    },
    {
      unitsFrom: 101,
      unitsTo: 200,
      label: "101-200ш бөөний захиалга (-5%)",
      unitPrice: round(p.unitPrice * 0.95),
      marketPrice: round(p.marketPrice * 0.95),
      unitPriceNoVat: round(p.unitPriceNoVat * 0.95),
      isDefault: false,
    },
  ];

  for (const tier of tiers) {
    const pkgPrice = tier.unitPrice * tier.unitsFrom;
    const existing = await prisma.productOption.findFirst({
      where: { productId: product.id, unitsFrom: tier.unitsFrom },
    });
    const data = { productId: product.id, pkgPrice, ...tier };
    if (existing) {
      await prisma.productOption.update({ where: { id: existing.id }, data });
    } else {
      await prisma.productOption.create({ data });
    }
  }

  return product;
}

async function main() {
  for (const p of testProducts) {
    const product = await upsertProduct(p);
    console.log(`Upserted ${product.name} (${product.id})`);
  }
  console.log(`Done: ${testProducts.length} test products with package options.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
