# my-clerk-react-router-app — Clerk integration and dev guide

This app is a React Router full-stack template with an example Clerk integration and a small Express server demonstrating server-side session verification. This README adds Clerk-specific setup and run instructions to the template README.

> Note: This repo contains a demo static auth page (auth.html) which is useful for UI prototyping only. Do not ship that page in production; see the Security section.

---

## What’s included

- Client (React Router): ClerkProvider wiring and protected routes in `app/root.tsx` and route components.
- Server (Express): `server/index.ts` — example of verifying Clerk sessions server-side using `@clerk/clerk-sdk-node` with a dev fallback (permissive) when `CLERK_SECRET_KEY` is not set.
- `.env.example`: template for env variables needed.

---

## Required environment variables

Create `my-clerk-react-router-app/.env.local` (do NOT commit) and add:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

- `VITE_CLERK_PUBLISHABLE_KEY` (pk_...): client-side key used by Clerk UI components.
- `CLERK_SECRET_KEY` (sk_...): server-side secret used by `@clerk/clerk-sdk-node` to verify session tokens. Keep this secret out of source control.

If `CLERK_SECRET_KEY` is not present, the example server will run in a permissive local mode for development only. Do NOT use this mode in production.

---

## Install

From the `my-clerk-react-router-app` folder:

```bash
npm install
# install Clerk node SDK and server deps (if not already installed)
npm install @clerk/clerk-sdk-node express dotenv
# dev helpers
npm install -D ts-node-dev typescript @types/express
```

---

## Helpful npm scripts (already added)

- `npm run dev` — start the React dev server (HMR)
- `npm run build` — build the app
- `npm run start` — serve the built server bundle (used in production flow)
- `npm run server:dev` — start the example Express server using `ts-node-dev` (dev)
- `npm run server:start` — run the built server JS (if you compile TS to `dist/`)

---

## Run locally (quick start)

1. Add your Clerk keys to `.env.local` as described above.
2. Start the React dev server:

```bash
npm run dev
```

3. Start the Express server in a separate terminal:

```bash
npm run server:dev
```

- React dev server default: http://localhost:5173
- Express server default: http://localhost:3000

---

## Endpoints to test

- Public: `GET http://localhost:3000/api/public`
- Debug token: `GET http://localhost:3000/api/debug/session`
- Protected: `GET http://localhost:3000/api/protected` (requires Authorization header)

Examples

- Dev fallback (no secret present):

```bash
curl -H "Authorization: Bearer demo-token" http://localhost:3000/api/protected
```

- With a real Clerk client session token (after signing in in the browser):

```bash
curl -H "Authorization: Bearer <CLERK_SESSION_TOKEN>" http://localhost:3000/api/protected
```

To get a session token for testing you can inspect the network or application storage while logged in (Clerk's client SDK typically sets session tokens/cookies). For a production flow the client will send the session token to your protected API or you will verify cookies on the server.

---

## How the server verifies sessions

`server/index.ts` attempts to use `@clerk/clerk-sdk-node` when `CLERK_SECRET_KEY` is present. The code includes a `verifyWithClerk` helper that tries common Clerk SDK methods and maps the verification result to a small `{ userId, sessionId, email }` object used by the example APIs.

If the SDK method surface differs for your installed version, update `verifyWithClerk` to call the correct method (I can do this for you if you tell me the SDK version or provide your `CLERK_SECRET_KEY`).

---

## Security checklist (before production)

- Remove `auth.html` or move it to `docs/` — it contains demo credentials and is for UI demo purposes only.
- Set `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` in your hosting provider's secrets (never commit them).
- Ensure the server uses secure HTTPS and secure cookie settings (HttpOnly, SameSite, Secure) if you rely on cookies.
- Verify session expiry/freshness server-side and check claims/roles before returning sensitive data.
- Add rate-limiting and monitoring on auth endpoints.
- Configure Clerk dashboard: add your production origins and redirect URIs.

---

## Deploying

- For server-based deployments, build the app and deploy the server bundle with your runtime (Docker, Fly, Vercel server functions, etc.).
- Make sure `CLERK_SECRET_KEY` is available in production environment variables.

---

## Remove demo auth page (recommended)

Before publishing:

```bash
# move demo auth page to docs folder (example)
git mv auth.html docs/auth-demo.html
# or delete if not needed
git rm auth.html
```

---

## Want me to finish the last steps?

I can:

- update `verifyWithClerk` to call the exact Clerk SDK method for your SDK version,
- run an end-to-end smoke test in this environment (you must add the keys to `.env.local`),
- or remove/move `auth.html` from the repo.

Tell me which of those you'd like and I’ll apply the change.
