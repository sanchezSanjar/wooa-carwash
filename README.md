# Wooa Carwash

Subscription car wash for apartment complexes: washers come to the residents' parking lot on fixed days and wash each car while it is parked at home. One app codebase runs on iOS, Android and the web.

## Structure

- `backend/` — NestJS API (MongoDB Atlas, Mongoose, JWT)
- `mobile/` — React Native app (Expo, Expo Router, TypeScript) for iOS, Android and web

## How it works

- **Members** sign up with name, phone and apartment name, then add one or more **cars**: plate number, brand, model, color, building number, parking floor, and when the car is usually home and when it leaves for work.
- Each car gets its own **wash plan**: a tariff, the wash days, a start date and optional **extra services** (interior vacuuming, perfume change, anti-rain polish, tire shine) that are done with every wash.
- **Tariffs**
  - **2 washes / month:** one weekday every other week, e.g. 1st and 3rd Monday.
  - **4 washes / month:** one weekday every week, e.g. every Tuesday (1st–4th).
  - **6 washes / month:** two weekdays in weeks 1 & 3 and one weekday in weeks 2 & 4, e.g. Monday and Friday in weeks 1 & 3, Wednesday in weeks 2 & 4.
  - "Week N" means the Nth occurrence of that weekday in the month; a 5th occurrence is skipped, so every month has exactly the tariff's number of washes.
- **Monthly price** = tariff price + (sum of extras per wash × washes per month). Prices are copied into the plan, so later price changes only affect new plans.
- **Admins** (emails in `ADMIN_EMAILS`) get a **Manage** tab: the day's wash route grouped by apartment and building with floor, parking window, owner phone and extras; mark each car washed or skipped; edit prices and hide plans or extras.

## Backend

```bash
cd backend
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, ADMIN_EMAILS
npm install
npm run start:dev
```

- API docs (Swagger): http://localhost:3000/docs
- Default tariffs and extras are created on first start if their collections are empty.
- `npm test` runs unit tests and `npm run test:e2e` runs API tests against an in-memory MongoDB.

| Method | Path | Access |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | public |
| GET | `/auth/me` · PATCH `/members/me` | member |
| GET | `/tariffs`, `/extras` | public |
| GET | `/admin/tariffs`, `/admin/extras` · POST/PATCH `/tariffs`, `/extras` | admin |
| GET | `/cars/me` · POST `/cars` · PATCH/DELETE `/cars/:id` | member |
| POST | `/subscriptions` · GET `/subscriptions/me` · PATCH `/subscriptions/:id`, `/subscriptions/:id/cancel` | member |
| GET | `/subscriptions` (all active) | admin |
| GET | `/washes?date=YYYY-MM-DD` · PATCH `/washes` (done / skipped / planned) | admin |

MongoDB collections: `members`, `cars`, `tariffs`, `extras`, `subscriptions`, `washes`. Planned washes are calculated from each subscription's schedule; `washes` only stores outcomes (done or skipped).

## Mobile and web

```bash
cd mobile
cp .env.example .env   # EXPO_PUBLIC_API_URL
npm install
npm start              # press w for the website, or scan the QR code with Expo Go
```

- On a real phone, set `EXPO_PUBLIC_API_URL` to your computer's local IP (e.g. `http://192.168.0.10:3000`).
- Website build: `npx expo export --platform web` creates a single-page app in `dist/`. Serve it with a fallback to `index.html` so links like `/plan/<id>` work.
