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
 * - If CLERK_SECRET_KEY is not set, it falls back to a permissive local demo verifier (dev only).
 * - If CLERK_SECRET_KEY is set and the SDK call fails, an error will be thrown.
 */
async function verifyWithClerk(sessionToken: string) {
  if (!process.env.CLERK_SECRET_KEY || !clerk) {
    // DEV fallback (permissive). DO NOT USE IN PRODUCTION.
    return { userId: "local-demo-user", sessionId: "local-session", email: "demo@local" };
  }

  // Try common Clerk SDK verification methods with graceful fallback
  // The Clerk Node SDK surface may have different helper names across versions — try several.
  try {
    // Preferred modern API: clerk.sessions.verifySession or clerk.sessions.verifySessionToken
    if ((clerk as any).sessions) {
      const sessions = (clerk as any).sessions;
      if (typeof sessions.verifySession === "function") {
        const verified = await sessions.verifySession(sessionToken);
        return mapClerkSession(verified);
      }
      if (typeof sessions.verifySessionToken === "function") {
        const verified = await sessions.verifySessionToken(sessionToken);
        return mapClerkSession(verified);
      }
      if (typeof sessions.verify === "function") {
        const verified = await sessions.verify(sessionToken);
        return mapClerkSession(verified);
      }
    }

    // Older SDKs may expose a top-level verifySession method
    if (typeof (clerk as any).verifySession === "function") {
      const verified = await (clerk as any).verifySession(sessionToken);
      return mapClerkSession(verified);
    }

    // If none of the known methods are present, throw an instructive error
    throw new Error(
      "Unable to find a session verification method on the Clerk SDK instance — check @clerk/clerk-sdk-node version and SDK docs."
    );
  } catch (err: any) {
    // Re-throw to be handled by the caller
    throw err;
  }
}

function mapClerkSession(verified: any) {
  // Map Clerk verification result to a minimal common shape used by the app
  if (!verified) return null;
  const userId = verified.userId || verified.user_id || verified.user?.id || verified.user?.user_id;
  const sessionId = verified.id || verified.sessionId || verified.session_id || verified.sid;
  const email = verified.email || verified.user?.primary_email || verified.user?.email_address;
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
    console.log("CLERK_SECRET_KEY detected — server will use Clerk SDK to verify sessions (if SDK supports it).");
  }
});
