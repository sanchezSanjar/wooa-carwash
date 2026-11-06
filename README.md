# Wooa Carwash

Car wash booking platform: customers pick a wash package and a time slot, the shop confirms and tracks each wash. One app codebase runs on iOS, Android and the web.

## Structure

- `backend/` — NestJS API (MongoDB Atlas, Mongoose, JWT)
- `mobile/` — React Native app (Expo, Expo Router, TypeScript) for iOS, Android and web

## Features

- **Customers:** register / log in, browse wash packages, pick a day and a free time slot, book with car details, view and cancel upcoming bookings.
- **Admins** (emails listed in `ADMIN_EMAILS`): a **Manage** tab with the day's bookings, customer details and revenue, moving bookings through *pending → confirmed → in progress → completed* (or cancelling them), and showing or hiding packages.
- **Scheduling:** open 09:00–19:00 Korea time, 30-minute slots, bookings up to 30 days ahead. A slot is full once every bay (`BAYS`) is busy for the whole wash.

## Backend

```bash
cd backend
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, ADMIN_EMAILS
npm install
npm run start:dev
```

- API docs (Swagger): http://localhost:3000/docs
- The default wash packages are created on first start if the `services` collection is empty.
- `npm test` runs unit tests and `npm run test:e2e` runs API tests against an in-memory MongoDB.

| Method | Path | Access |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | public |
| GET | `/auth/me` | logged in |
| GET | `/services`, `/services/:id` | public |
| GET | `/services/admin` · POST `/services` · PATCH `/services/:id` | admin |
| GET | `/bookings/availability?date=YYYY-MM-DD&serviceId=` | public |
| POST | `/bookings` · GET `/bookings/me` · PATCH `/bookings/:id/cancel` | logged in |
| GET | `/bookings?date=&status=` · PATCH `/bookings/:id/status` | admin |

MongoDB collections: `members` (users), `services`, `bookings`.

## Mobile and web

```bash
cd mobile
cp .env.example .env   # EXPO_PUBLIC_API_URL
npm install
npm start              # press w for the website, or scan the QR code with Expo Go
```

- On a real phone, set `EXPO_PUBLIC_API_URL` to your computer's local IP (e.g. `http://192.168.0.10:3000`).
- Website build: `npx expo export --platform web` creates a single-page app in `dist/`. Serve it with a fallback to `index.html` so links like `/book/<id>` work.
