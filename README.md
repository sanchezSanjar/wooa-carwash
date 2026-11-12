# Wooa Carwash

Subscription car wash for apartment complexes: washers come to the residents' parking lot on fixed days and wash each car while it is parked at home. One app codebase runs on iOS, Android and the web.

## Structure

- `backend/` — NestJS monorepo (MongoDB Atlas, Mongoose, JWT)
  - `apps/wooa-api` — REST API used by the app and website
  - `apps/wooa-batch` — scheduled jobs (bills, payment and wash reminders, weather, end-of-day close-out)
  - `libs/common` — shared schemas, schedule/billing/weather rules, SMS and database modules (`@app/common/...`)
- `mobile/` — React Native app (Expo, Expo Router, TypeScript) for iOS, Android and web
- `deploy/nginx/` — nginx config for the server (HTTPS, API proxy, website)

## Who does what

| Role | Can |
| --- | --- |
| **Member** | Sign up with an SMS code, log in with phone + password, reset the password by SMS. Add cars, choose and change each car's plan, wash days and extras, cancel. See next washes, before/after photos, rate washes (1–5 stars + comment), see bills and updates. |
| **Washer** | Day sheet (read), mark washes washed / skipped, upload before (scratch inspection) and after photos. |
| **Admin** | Everything: members (create accounts, change roles, block), day sheets (arrange, assign washers, move cars between days), payments, reviews, plans and prices. |

First admins come from `ADMIN_PHONES` in `backend/.env` (phone numbers only, since they are proven by the SMS code); after that roles are managed in the app (Manage › Members).

## How it works

- **Cars**: plate number, brand, model, color, building number, parking floor, and when the car is usually home / leaves for work.
- **Plans** (per car):
  - **2 washes / month:** one weekday every other week, e.g. 1st and 3rd Monday.
  - **4 washes / month:** one weekday every week, e.g. every Tuesday (1st–4th).
  - **6 washes / month:** two weekdays in weeks 1 & 3 and one weekday in weeks 2 & 4.
  - "Week N" is the Nth occurrence of that weekday in the month; a 5th occurrence is skipped, so every month has exactly the plan's number of washes.
  - Extras (vacuuming, perfume, anti-rain polish, tire shine) are done with every wash. Monthly price = plan + extras × washes.
- **Day sheet**: the admin's workbook for one day. It starts as the schedule; admins reorder cars, assign washers, add notes, pull in missed or upcoming cars, or move a car to another day, then save. Only that day's sheet is saved — cars, members and plans never change. A moved wash keeps its scheduled date and records the day it was really washed.
- **Excel**: “Export to Excel” downloads 1, 7 or 14 days, one tab per day. Edit the yellow columns (order, day, washer, note) — change the Day to move a car — and “Import from Excel” shows every change and problem before anything is saved. Imports only change day sheets, never cars, members, plans or wash results.
- **Bills**: on the 1st (and daily for new plans) the batch server issues each car's bill — a plan that starts mid-month pays only for the washes left that month. Bills are due on `PAYMENT_DUE_DAY` (at least 7 days after issue). Members get an SMS when it's issued, 3 days before it's due and weekly while overdue. Payment happens outside the app (bank transfer, cash); admins mark bills paid.
- **Languages**: Korean and English. The app starts in the phone's language (Korean unless the phone is set to English) and has a 한국어 / English switch on the Account page and in the website header. The choice is saved on the member's account, so notifications, SMS, API error messages and Excel files follow it; new members get Korean texts until they switch. App texts live in `mobile/src/lib/ko.ts` (keys are the English text), server texts in `backend/libs/common/src/i18n.ts` and `notify.ts`. Plan and extra names the shop started with are translated; names an admin types are shown as typed.
- **Weather**: forecasts from the Korea Meteorological Administration are stored for the next days and shown on the day sheets; the evening before, members with a wash get a notice when rain or snow is likely.

## Batch schedule (Korea time)

| Time | Job |
| --- | --- |
| 05:30, 17:30 | Refresh weather forecasts |
| 09:00 | Issue this month's missing bills |
| 10:00 | Remind bills due in 3 days |
| 10:30 | Remind overdue bills (weekly) |
| 17:45 | Rain alerts for tomorrow's washes |
| 20:00 | Reminders for tomorrow's washes |
| 23:30 | Mark today's unrecorded washes skipped |

## Backend

```bash
cd backend
cp .env.example .env     # MONGODB_URI, JWT_SECRET, ADMIN_PHONES, Solapi, bank account, KMA key …
npm install
npm run start:dev        # API on :3000, docs at /docs
npm run start:dev:batch  # batch server (second terminal)
```

- The app sends `Accept-Language: ko` or `en`; the API answers errors, Excel exports and import previews in that language (English when the header is missing).
- Without Solapi keys SMS runs in log-only mode (codes appear in the server log); without a KMA key weather is skipped.
- `npm run build` builds both apps into `dist/apps/`; run them with `npm run start:prod` and `npm run start:prod:batch`. Node 22+ is required.
- Washer photos are stored on the server in `UPLOAD_DIR` (keep that folder outside the code so deploys don't remove it). They are not public: the API hands out `/uploads/...` links signed for 1–2 hours, only to members who may see that wash.
- `npm test` runs unit tests; `npm run test:e2e` runs API and batch tests against an in-memory MongoDB.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/reset-password` · `GET /auth/me` |
| Members | `PATCH /members/me` (incl. `language`: `ko` / `en`) · `POST /members/me/password` · admin: `GET/POST /members`, `GET/PATCH /members/:id` |
| Catalog | `GET /tariffs`, `/extras` · admin: `GET /admin/tariffs`, `/admin/extras`, `POST/PATCH /tariffs`, `/extras` |
| Cars | `GET /cars/me` · `POST /cars` · `PATCH/DELETE /cars/:id` · admin: `GET /cars?ownerId=` |
| Plans | `POST /subscriptions` · `GET /subscriptions/me` · `PATCH /subscriptions/:id`, `/:id/tariff`, `/:id/cancel` · admin: `GET /subscriptions` |
| Washes | staff: `GET/PATCH /washes`, `POST /washes/photos`, `DELETE /washes/photos/:id` · `GET /washes/detail` · `PUT /washes/review` · admin: `GET /washes/reviews` |
| Day sheets | staff: `GET /daysheets/:date`, `/daysheets/staff` · admin: `PUT /daysheets/:date`, `POST /daysheets/:date/move`, `GET /daysheets/:date/candidates`, `GET /daysheets/export?from=&days=`, `POST /daysheets/import/preview`, `POST /daysheets/import/apply` |
| Bills | `GET /invoices/me` · admin: `GET /invoices?month=`, `/invoices/overdue`, `PATCH /invoices/:id` |
| Updates | `GET /notifications/me` · `PATCH /notifications/read-all` |

MongoDB collections: `members`, `otps`, `revokedtokens`, `cars`, `tariffs`, `extras`, `subscriptions`, `washes`, `daysheets`, `invoices`, `notifications`, `forecasts`.

## Mobile and web

```bash
cd mobile
cp .env.example .env   # EXPO_PUBLIC_API_URL
npm install
npm start              # press w for the website, or scan the QR code with Expo Go
```

- On a real phone, set `EXPO_PUBLIC_API_URL` to your computer's local IP (e.g. `http://192.168.0.10:3000`).
- Website build: `npx expo export --platform web` creates a single-page app in `dist/`. Serve it with a fallback to `index.html` so links like `/plan/<id>` work (`deploy/nginx/wooa-carwash.conf` does).
- Release builds and the website need an `https://` `EXPO_PUBLIC_API_URL`; the app stops at start-up otherwise.

## Going live

1. `backend/.env` on the server: `NODE_ENV=production`, a random `JWT_SECRET` (`openssl rand -hex 32`), the Solapi keys, `CORS_ORIGINS` with the website address, and `TRUST_PROXY=1` behind nginx. The servers refuse to start while one of these is unsafe.
2. Set up nginx from `deploy/nginx/wooa-carwash.conf` (steps are at the top of the file).
3. Build the app and website with `EXPO_PUBLIC_API_URL=https://api.<your domain>`.
4. `/docs` is off in production; set `API_DOCS=true` to turn it on.
