# Wooa Carwash

Car wash platform. Monorepo with a NestJS backend and a React Native (Expo) mobile app, both in TypeScript.

## Structure

- `backend/` — NestJS API. Database: MongoDB Atlas via Mongoose. Auth: JWT (passport-jwt), passwords hashed with bcryptjs. Validation: class-validator / class-transformer. Docs: Swagger.
- `mobile/` — React Native app with Expo and Expo Router. Talks to the backend over HTTP using `EXPO_PUBLIC_API_URL`.

## Deployment

- Backend runs on an AWS Lightsail server.
- Database is hosted on MongoDB Atlas (not on the server).
- Mobile app is distributed through the Google Play Store and Apple App Store (built with EAS).

## Backend

```bash
cd backend
npm run start:dev   # dev server with watch
npm run build       # compile
npm run lint        # oxlint
npm test            # vitest
```

- Config comes from `backend/.env` (see `.env.example`): `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
- Use `bcryptjs`, not `bcrypt` (native build is blocked on this machine).
- Organize code by feature module (`src/<feature>/<feature>.module.ts`, controller, service, schemas, dto).

## Mobile

```bash
cd mobile
npm start              # Expo dev server, open with Expo Go
npx expo install <pkg> # always use this instead of npm install for app packages
npx tsc --noEmit       # typecheck
npx expo lint          # lint
```

- Expo changes between SDK versions. Check the `expo` version in `mobile/package.json` and use the matching docs at https://docs.expo.dev/versions/ before using Expo APIs.
- Routes live in `mobile/src/app/` (Expo Router). Keep components, hooks and utils outside `src/app/`.
- `ios/` and `android/` are generated. Do not create or edit them by hand; configure via `app.json`.

## Git rules

- Branches: `main` and `develop`.
- Commit messages: short, lowercase, imperative (e.g. `add booking module`).
- Never add AI attribution to commits or PRs (no `Co-Authored-By` lines, no "Generated with" footers).
- `AGENTS.md` and `CLAUDE.md` are intentionally committed in this repo.
- Never commit `.env` files or secrets.
