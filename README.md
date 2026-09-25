# pospaper-backend

Express + Prisma + PostgreSQL API for the pospaper-nextjs storefront.

## Setup

```bash
cp .env.example .env
docker compose up -d          # starts Postgres on localhost:5432
npm install
npm run prisma:migrate        # creates tables (prompts for a migration name)
npm run seed                  # loads the product catalog from lib/data.js
npm run dev                   # starts the API on http://localhost:4000
```

## Database

```bash
docker compose up -d           # start Postgres in the background
docker compose ps              # check it's running
docker compose down            # stop it (data persists in the pospaper_pgdata volume)
npm run prisma:studio          # browse/edit tables at http://localhost:5555
```

## Email (OTP)

Registration emails a one-time code via `src/lib/mailer.js` (SMTP via
`nodemailer`). Set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`
in `.env` to send for real. Until those are set, the code is printed to the
server console instead of being emailed, so the flow still works locally.

## Endpoints

- `POST /api/auth/register/request-otp` `{ phone, email, password, name }` — emails a 6-digit code (5 min expiry)
- `POST /api/auth/register/verify-otp` `{ email, code }` — creates the account and returns a token
- `POST /api/auth/login` `{ phone, password }`
- `GET  /api/auth/me` (Bearer token)
- `GET  /api/products` `?category=thermal`
- `GET  /api/products/:id`
- `POST/PUT/DELETE /api/products` (admin only) — `categories` in the body is an array of category ids, e.g. `["thermal"]`; `images` is an array of up to 3 image URLs (enforced both in the API and with a DB check constraint)
- `GET  /api/categories`
- `POST /api/categories` `{ id, label }` (admin only)
- `PUT  /api/categories/:id` `{ label }` (admin only)
- `DELETE /api/categories/:id` (admin only)
- `GET  /api/products/:productId/options` — a product's buying options (package sizes)
- `POST /api/products/:productId/options` `{ units, label?, pkgPrice, unitPrice, marketPrice?, unitPriceNoVat?, isDefault? }` (admin only)
- `PUT  /api/products/:productId/options/:optionId` (admin only)
- `DELETE /api/products/:productId/options/:optionId` (admin only)
- `POST /api/orders` `{ items: [{ id, optionId?, qty }], customerName, phone, address }`
- `GET  /api/orders/mine` (Bearer token)
- `GET  /api/orders` (admin only)
- `GET  /api/orders/:id` (owner or admin)
- `PATCH /api/orders/:id/status` `{ status }` (admin only)

Prices for orders are always looked up from the `Product`/`ProductOption` table
server-side, never trusted from the client cart payload. A product can have
several buying options (e.g. 50pcs vs 100pcs per box), each with its own
`pkgPrice`, `unitPrice`, `marketPrice`, and `unitPriceNoVat`; cart items pass
`optionId` to pick one, or omit it to fall back to the product's base price.

To promote a user to admin, set their `role` to `ADMIN` directly in the DB
(`npm run prisma:studio` is the quickest way).
# pospaper-back
