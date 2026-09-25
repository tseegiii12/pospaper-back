const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Mirrors pospaper-nextjs/lib/data.js `products` so the DB starts with the
// same catalog the frontend currently renders from static data.
const products = [
  {
    id: "80x80",
    categories: ["thermal"],
    stockBadge: "🟢 850 хайрцаг бэлэн",
    tag: "BPA-Free",
    tagClass: "text-orange-600",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuCs11sMhcMwAqlvnTU0-JUrQx87imeGf_1LDRcODC3Gl-tNg5OAr_3FoZ03UAsYCF8OnJAZuFoEI93sQME4feV0Yk-v0HzTKcJtdtJpchA17tzKhjoyjTZdYoz-au-GJuujlheBq6l-NketfE-fm048NSqKCWTzsuk5MJUNg1DFyElr7P2ebN-MTvO7eRGYbg417mwc6LueLFmX3jl77D1BAefRfmwKkRx9Tvjmu8z5RGHssv6IRJzY"],
    imgTag: "80 × 80 мм",
    rating: "4.95",
    ordersCount: 480,
    name: "POS цаас 80 × 80 мм (50 ширхэг / багц)",
    description: "Япон чанарын зузаан термал давхарга. Тохирох: Epson, Star, Sunmi, Xprinter, бүх 80мм суурин төхөөрөмж.",
    pkgPrice: 175000,
    unitPrice: 3500,
    recommended: true,
  },
  {
    id: "57x40",
    categories: ["thermal"],
    stockBadge: "🟢 620 хайрцаг бэлэн",
    tag: "Гар ПОС",
    tagClass: "text-blue-600",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuDbRXeSNp59axECkGa0lApohYL7wqD8SjopEgszfwYwUoc6cG2zyUfReqPAtHG_2YgZjssuOGNb9TsIPhvQ1zCR0wd183UXY9qfpJG2b7xRz5SjX6g0C7dfLLhW3_yLIsr2ylhAEGLlrwGOTrj0Di86ddE8JSRT1Mespkkp3zcToT9knrhglBL8WC9irM3MKjAAGZ4jfXYpnUfJv5-YKe3C7QoP-0rrJn2jqnI0qFrNsiOPLV7fReNF"],
    imgTag: "57 × 40 мм",
    rating: "4.96",
    ordersCount: 320,
    name: "POS цаас 57 × 40 мм (50 ширхэг / багц)",
    description: "Тохирох: ХААН, Голомт банкны гар ПОС, Verifone VX520/680, Ingenico, PAX A920.",
    pkgPrice: 45000,
    unitPrice: 900,
    recommended: true,
  },
  {
    id: "57x50",
    categories: ["thermal"],
    stockBadge: "🟢 410 хайрцаг бэлэн",
    tag: "Sunmi / Таксиметр",
    tagClass: "text-blue-600",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuB-AkyafxLWJ5fo-C6c0yEc71dra97bqNFGlDfrRjk9CDKyI_GTMJpSH2jtsmyvsMU4_p39P6nsZ0ku88YsBSihxmaj2YjZ6Ph6r0K0xhMUOlqWecesKYKczCXs2_BT3OiaeHHZpMAr-WAkro1SyJCCQumbET6JN5pauZS0GiuxJ4wEhllQENNEyXOhm80B0_AU7GqP5Gald4O89MJ5GTzZgon8pWWYsJ5JBG8AWVDogPTTNxXwn4Lm"],
    imgTag: "57 × 50 мм",
    rating: "4.92",
    ordersCount: 190,
    name: "POS цаас 57 × 50 мм (50 ширхэг / багц)",
    description: "Тохирох: Sunmi V2/V2 Pro, гар мобайл хэвлэгч, таксиметрын хэвлэгч, Bluetooth принтер.",
    pkgPrice: 55000,
    unitPrice: 1100,
    recommended: true,
  },
  {
    id: "76x95",
    categories: ["bond"],
    stockBadge: "🟢 350 хайрцаг бэлэн",
    tag: "Гал тогооны ангилал",
    tagClass: "text-orange-600",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuBs3XnvZ1iDMnzfjK8q7rjpbfLCKx2366FfMi6ry5EA3Qyzw-C1PP41vdKQJy7QjoIppetysJQEBR16KL5jpYnm0gfuB6WkxI4hexCMFme079igd4m3zn32ZN1yrfMWQsAKeHqN2vzrbFmY8snStwzrY7mFnOW3eYKo6YYusf0xEt6xfrAxRuLgUoIu1kYfbf-hT30TnfuMRRkxZk4S8DfeuxByFjtSS5ayhevOIMo3TiCs2SlsDoLz"],
    imgTag: "Цагаан/Шар 2 хуулбар",
    rating: "4.90",
    ordersCount: 230,
    name: "Гал тогооны 2 хуулбарт цаас 76мм (50 ш/багц)",
    description: "Халуунд харлахгүй. Ресторан, бар, зоогийн газрын гал тогооны цохилтот хэвлэгчид зориулсан.",
    pkgPrice: 135000,
    unitPrice: 2700,
    recommended: true,
  },
  {
    id: "ribbon",
    categories: ["ribbons"],
    stockBadge: "🟢 1,100 хайрцаг бэлэн",
    tag: "Хар/Улаан",
    tagClass: "text-purple-600",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuCQcgHa9wjn1iaET6zlfOMpE9OQTNQKAfi7Y6_Cejs4yqKOXkDevX4ZmifjS_7oku3DLgCWXUHOEG4Plt3CGg7mQpSikut3oS1acym_GdQoZpiYFk0ZvF_O5KDmSUvk-VnbYtrlktvAeubIIxqYDH6pe0YJc6ZxZAHR-IDSbVVQjGXMpD2zA6YRVBO2f7fxvZ1iBS_kdI6OOeaTb6vNRFE1voO24ULb4a9XZ3Ed8VanVSSzNXw8V8Rm"],
    imgTag: "6 ширхэг хайрцаг",
    rating: "4.94",
    ordersCount: 180,
    name: "Epson ERC-30/34/38 Принтерийн тууз (6 ш/хайрцаг)",
    description: "Тод хар/улаан хэвлэлттэй оригнал чанар. Epson TM-U220 болон Star SP700 принтерт төгс тохирно.",
    pkgPrice: 55000,
    unitPrice: 9160,
  },
  {
    id: "atm",
    categories: ["atm", "sticker"],
    stockBadge: "🟢 280 хайрцаг бэлэн",
    tag: "АТМ & Киоск",
    tagClass: "text-blue-600",
    images: ["https://lh3.googleusercontent.com/aida/AEtjO1UrQ3J7OQNti0IGFqbKWoylRTnUgOKmBR4HzPNfChLkYvf5pxSuGLRU88OpIawnmLSBEmkoMha5Qme7bn6hEMuJ7exnFPem378LIJBlGKhWcBrvnaayk1HWXv3gyXKZjNnBsbZO_tF7eVLgVlgYhnvl20kx4fMUUdkr1IAeBfM8J18lqr3X6a3slrXzPRscMjWfihftzuXOPSI6RJyVl49knfZeD17g9mfo7tc9Ut5rRbCBwg4adHY1M0o"],
    imgTag: "Зузаан 65 GSM",
    rating: "4.97",
    ordersCount: 150,
    name: "АТМ & Киоск термал цаас 80мм (50 ш/багц)",
    description: "65 GSM нягтралтай урт хугацаанд тод хадгалагдах бат бөх суурь цаас. Банкны төхөөрөмжид тохирно.",
    pkgPrice: 140000,
    unitPrice: 2800,
  },
];

// Mirrors pospaper-nextjs/lib/data.js `catalogTabs` (minus the "all" pseudo-tab).
const categories = [
  { id: "thermal", label: "Термал кассын цаас" },
  { id: "bond", label: "И-баримт & Бонд" },
  { id: "sticker", label: "Баркод sticker & Шошго" },
  { id: "ribbons", label: "Принтерийн тууз (Ribbon)" },
  { id: "atm", label: "АТМ & Киоск цаас" },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }

  for (const { categories: categoryIds, pkgPrice, ...product } of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: { ...product, categories: { set: categoryIds.map((id) => ({ id })) } },
      create: { ...product, categories: { connect: categoryIds.map((id) => ({ id })) } },
    });

    // Every product from lib/data.js is sold as a 50-unit package; seed that
    // as its default buying option. Additional pack sizes (100, 200, ...)
    // can be added per product later via POST /api/products/:id/options.
    const defaultOption = await prisma.productOption.findFirst({
      where: { productId: product.id, isDefault: true },
    });
    const optionData = {
      productId: product.id,
      unitsFrom: 50,
      label: "50ш / багц",
      pkgPrice,
      unitPrice: product.unitPrice,
      marketPrice: product.marketPrice,
      unitPriceNoVat: product.unitPriceNoVat,
      isDefault: true,
    };
    if (defaultOption) {
      await prisma.productOption.update({ where: { id: defaultOption.id }, data: optionData });
    } else {
      await prisma.productOption.create({ data: optionData });
    }
  }
  console.log(`Seeded ${categories.length} categories, ${products.length} products, and their default 50-unit options.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
