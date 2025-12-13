import type { FastifyRequest, FastifyReply } from "fastify";
import { UAParser } from "ua-parser-js";
import { Log } from "@/models/log";
import type { JwtPayload } from "@/types/token";

export interface ClientInfo {
  ip: string | null;
  country: string | null;
  browser: string | null;
  system: string | null;
}

// Skip GeoIP for private / localhost IPs to avoid useless external calls
const PRIVATE_IP_REGEX =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1|fc00:|fd00:)/;

async function getCountryFromIp(ip: string | null): Promise<string | null> {
  if (!ip || PRIVATE_IP_REGEX.test(ip)) return null;

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      country?: string;
      country_code?: string;
    };

    return data.country || data.country_code || null; // e.g. "US"
  } catch {
    return null;
  }
}

export async function attachClientInfo(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // 1) IP resolution (proxy-aware)
    const xff = request.headers["x-forwarded-for"] as string | undefined;
    const ip =
      xff?.split(",")[0]?.trim() ||
      (request.socket as any)?.remoteAddress ||
      request.ip || // requires fastify.setTrustProxy(true) when behind a proxy
      null;

    // 2) User-Agent parsing
    const userAgent = request.headers["user-agent"] || "";
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();

    const browserName = ua.browser.name ?? "Unknown";
    const browserVersion = ua.browser.version || null;
    const osName = ua.os.name ?? "Unknown OS";
    const osVersion = ua.os.version || null;

    // 3) Request URL info
    const method = request.method.toLowerCase(); // "post"
    const rawUrl = request.raw.url || "/";
    const host = request.headers.host || "unknown-host";
    const protocol = request.protocol; // "http" | "https"

    const fullUrl = `${protocol}://${host}${rawUrl}`;

    // 4) Country from IP (if public IP)
    const country = await getCountryFromIp(ip);

    // 5) Auth user from JWT (if present)
    const authUser = (request.user as JwtPayload | undefined) || null;

    // 6) Save log
    await new Log({
      ip: ip || "unknown",
      country,
      os: { system: osName, version: osVersion },
      browser: { types: browserName, version: browserVersion },
      method,
      url: fullUrl,
      userId: authUser ? authUser.userId : null,
    }).save();
  } catch (err) {
    // Never break the request if logging fails
    console.log({ err }, "Failed to attach client info / save log");
  }
}
