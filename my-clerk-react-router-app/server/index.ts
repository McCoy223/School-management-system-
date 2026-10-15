import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

/**
 * Minimal Clerk-aware Express example.
 *
 * This example provides a `requireAuth` middleware that:
 * - returns 401 when no session token is provided
 * - when CLERK_SECRET_KEY is present, you should wire the verifyWithClerk function
 *   to call Clerk's server API (or use @clerk/clerk-sdk-node) to verify the session
 *   token and populate req.auth with the verified session/user info.
 *
 * For development you can run this server without Clerk keys; the middleware will
 * accept any request that includes an Authorization header, but this should NEVER
 * be used in production.
 */

declare global {
  // augment Express Request to include auth info
  namespace Express {
    interface Request {
      auth?: { userId?: string; sessionId?: string; [k: string]: any };
    }
  }
}

// Helper: placeholder verifier. Replace implementation with a real call to Clerk.
async function verifyWithClerk(sessionToken: string) {
  // Example (recommended): install @clerk/clerk-sdk-node and use its helpers here.
  // const { Clerk } = require('@clerk/clerk-sdk-node');
  // const clerk = new Clerk({ apiKey: process.env.CLERK_SECRET_KEY });
  // const verified = await clerk.sessions.verifySession(sessionToken);
  // return verified;

  // Lightweight default behaviour for local development when CLERK_SECRET_KEY is NOT set
  if (!process.env.CLERK_SECRET_KEY) {
    // NOTE: this is intentionally permissive for local testing only.
    // It simply returns a demo user object and MUST NOT be used in production.
    return { userId: "local-demo-user", sessionId: "local-session", email: "demo@local" };
  }

  // If CLERK_SECRET_KEY is set but the helper isn't implemented, throw so the developer knows.
  throw new Error(
    "CLERK_SECRET_KEY is set but verifyWithClerk is not implemented. Install @clerk/clerk-sdk-node and replace verifyWithClerk with the Clerk SDK verification call. See my-clerk-react-router-app/server/README.md for instructions."
  );
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.header("authorization") || req.header("x-session-token");
    if (!authHeader) {
      return res.status(401).json({ error: "Missing Authorization header or X-Session-Token" });
    }

    // Typical form: Authorization: Bearer <token>
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (!token) return res.status(401).json({ error: "Empty token" });

    const verified = await verifyWithClerk(token);
    req.auth = verified;
    return next();
  } catch (err: any) {
    console.error("Auth verification failed:", err?.message || err);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

app.get("/api/public", (req, res) => {
  res.json({ message: "This is a public endpoint" });
});

app.get("/api/protected", requireAuth, (req, res) => {
  res.json({ message: "Protected data", auth: req.auth });
});

// Health + quick session debug endpoint (dev only)
app.get("/api/debug/session", (req, res) => {
  const authHeader = req.header("authorization") || req.header("x-session-token");
  res.json({ hasToken: !!authHeader, tokenPreview: authHeader ? authHeader.slice(0, 24) : null });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Express auth example running on http://localhost:${PORT}`);
  if (!process.env.CLERK_SECRET_KEY) {
    console.warn(
      "CLERK_SECRET_KEY not set — the requireAuth middleware will use a permissive local demo verifier. Do not use in production."
    );
  }
});
