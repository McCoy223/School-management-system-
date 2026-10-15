import express from "express";
import dotenv from "dotenv";
import { Clerk } from "@clerk/clerk-sdk-node";

dotenv.config();

const app = express();
app.use(express.json());

/**
 * Clerk client (server-side) — requires CLERK_SECRET_KEY in env
 */
const clerk = process.env.CLERK_SECRET_KEY ? new Clerk({ apiKey: process.env.CLERK_SECRET_KEY }) : null;

/**
 * Minimal types augmentation for Express Request auth property
 */

declare global {
  namespace Express {
    interface Request {
      auth?: { userId?: string; sessionId?: string; [k: string]: any };
    }
  }
}

/**
 * verifyWithClerk: verifies a session token using the Clerk SDK.
 *
 * This implementation prefers the explicit server-side verification method
 * `clerk.sessions.verifySessionToken(token)` which is the recommended approach
 * in recent Clerk Node SDKs. If the SDK doesn't expose that method it will
 * raise a clear error instructing the developer to update the SDK.
 *
 * If CLERK_SECRET_KEY is not set, a permissive local demo verifier is used
 * for development only. DO NOT use the fallback in production.
 */
async function verifyWithClerk(sessionToken: string) {
  if (!process.env.CLERK_SECRET_KEY || !clerk) {
    // DEV fallback (permissive). DO NOT USE IN PRODUCTION.
    return { userId: "local-demo-user", sessionId: "local-session", email: "demo@local" };
  }

  // Production: require the Clerk SDK verification method to exist
  const sessions = (clerk as any).sessions;
  if (!sessions) {
    throw new Error(
      "The installed @clerk/clerk-sdk-node instance does not expose a 'sessions' helper. Ensure you're using a compatible SDK version."
    );
  }

  // Prefer verifySessionToken, fall back to verifySession only if present
  if (typeof sessions.verifySessionToken === "function") {
    const verified = await sessions.verifySessionToken(sessionToken);
    return mapClerkSession(verified);
  }

  if (typeof sessions.verifySession === "function") {
    const verified = await sessions.verifySession(sessionToken);
    return mapClerkSession(verified);
  }

  throw new Error(
    "Unable to find a compatible session verification method on Clerk SDK. Update @clerk/clerk-sdk-node or modify verifyWithClerk to match the SDK surface."
  );
}

function mapClerkSession(verified: any) {
  if (!verified) return null;
  const userId = verified.userId || verified.user_id || verified.user?.id || verified.user?.user_id;
  const sessionId = verified.id || verified.sessionId || verified.session_id || verified.sid;
  const email = verified.email || verified.user?.primary_email_address?.email_address || verified.user?.primary_email || null;
  return { userId, sessionId, email, raw: verified };
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.header("authorization") || req.header("x-session-token");
    if (!authHeader) {
      return res.status(401).json({ error: "Missing Authorization header or X-Session-Token" });
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (!token) return res.status(401).json({ error: "Empty token" });

    const verified = await verifyWithClerk(token);
    if (!verified) return res.status(401).json({ error: "Invalid or expired session" });

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

app.get("/api/debug/session", (req, res) => {
  const authHeader = req.header("authorization") || req.header("x-session-token");
  res.json({ hasToken: !!authHeader, tokenPreview: authHeader ? authHeader.slice(0, 24) : null, envHasSecret: !!process.env.CLERK_SECRET_KEY });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Express auth example running on http://localhost:${PORT}`);
  if (!process.env.CLERK_SECRET_KEY) {
    console.warn(
      "CLERK_SECRET_KEY not set — the requireAuth middleware will use a permissive local demo verifier. Do not use in production."
    );
  } else {
    console.log("CLERK_SECRET_KEY detected — server will use Clerk SDK to verify sessions.");
  }
});
