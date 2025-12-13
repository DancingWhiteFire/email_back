// src/middleware/botCheck.ts
import type { FastifyReply, FastifyRequest } from "fastify";

interface IpStats {
  count: number;
  firstSeen: number;
}

const IP_WINDOW_MS = 60_000; // 1 minute
const IP_MAX_REQUESTS = 60; // max requests per IP per window; tune this

// Very naive list of obvious non-browser clients you probably never want
// calling your frontend-origin-only API endpoints directly.
const SUSPICIOUS_USER_AGENT_PATTERNS: RegExp[] = [
  /curl/i,
  /wget/i,
  /python-requests/i,
  /httpclient/i,
  /java/i,
  /bot/i,
];

const ipStats = new Map<string, IpStats>();

/**
 * Resolve the client IP in a Fastify-friendly way.
 *
 * If `trustProxy: true` is set on the Fastify instance (recommended when
 * you're behind nginx / Cloudflare / a load balancer), `request.ip` will
 * already be the real client IP taken from `X-Forwarded-For`.
 *
 * This helper just gives you one place to centralise that logic.
 */
export function getClientIp(request: FastifyRequest): string {
  if (request.ip && request.ip !== "::1") {
    return request.ip;
  }

  // Fallback: read from X-Forwarded-For header if present
  const xff = request.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    return xff.split(",")[0]!.trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0]!;
  }

  // Final fallback: direct socket address
  // request.socket is Node's underlying socket; remoteAddress gives the IP.
  return (request.socket as any)?.remoteAddress ?? "unknown";
}

/**
 * "Bot check" middleware that combines:
 *  - per-IP rate limiting in memory
 *  - basic User-Agent / header sanity checks
 *  - a shared secret header (X-Bot-Check) for your own frontend
 *
 * Attach this as `preHandler: [botCheck]` on routes that should only be
 * called from your real frontend, not from random scripts on the internet.
 */
export async function botCheck(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const clientIp = getClientIp(request);

  // 1) Basic User-Agent / header sanity
  const userAgent = (request.headers["user-agent"] || "").toString();
  const accept = request.headers["accept"];
  const contentType = request.headers["content-type"];

  if (
    SUSPICIOUS_USER_AGENT_PATTERNS.some((re) => re.test(userAgent)) ||
    (!accept && !contentType)
  ) {
    console.log(
      { clientIp, userAgent, accept, contentType },
      "Blocked suspicious client (UA / missing headers)"
    );
    reply.code(403).send({
      error: "Forbidden",
      message: "Suspicious client",
    });
    return;
  }

  // 2) Very simple in-memory per-IP rate limiting
  const now = Date.now();
  const current = ipStats.get(clientIp);

  if (!current) {
    ipStats.set(clientIp, { count: 1, firstSeen: now });
  } else {
    if (now - current.firstSeen > IP_WINDOW_MS) {
      // Reset the window
      ipStats.set(clientIp, { count: 1, firstSeen: now });
    } else {
      current.count += 1;
      if (current.count > IP_MAX_REQUESTS) {
        console.log(
          { clientIp, count: current.count },
          "Rate limit exceeded in botCheck"
        );
        reply.code(429).send({
          error: "Too Many Requests",
          message: "Too many requests from this IP, please slow down.",
        });
        return;
      }
    }
  }

  // 3) Shared-secret header check (existing behaviour you already had)
  // const headerToken = request.headers["x-bot-check"];
  // const secret = process.env.BOT_SECRET;

  // if (!secret) {
  //   // If BOT_SECRET is not set we only rely on IP / UA checks.
  //   request.log.warn(
  //     { clientIp },
  //     "BOT_SECRET is not set. botCheck only uses IP / UA checks."
  //   );
  //   return;
  // }

  // if (!headerToken || headerToken !== secret) {
  //   request.log.warn(
  //     { clientIp },
  //     "Bot check failed: X-Bot-Check header missing or invalid"
  //   );
  //   reply.code(403).send({
  //     error: "Forbidden",
  //     message: "Bot check failed",
  //   });
  //   return;
  // }

  // If we get here, the request is allowed to continue
}
