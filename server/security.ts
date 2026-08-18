import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; expiresAt: number };

const buckets = new Map<string, Bucket>();

function clientAddress(request: Request) {
  const forwarded = request.headers["x-forwarded-for"];
  return Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded?.split(",")[0]?.trim() ?? request.ip ?? "unknown");
}

export function securityHeaders(
  _request: Request,
  response: Response,
  next: NextFunction
) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' https://manus-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://manus-analytics.com https://api.manus.im; img-src 'self' data: https:; form-action 'self'"
    );
  }
  next();
}

export function rateLimit(
  windowMs: number,
  maxRequests: number,
  scope: string
) {
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    if (buckets.size > 10_000) {
      Array.from(buckets.entries()).forEach(([bucketKey, bucketValue]) => {
        if (bucketValue.expiresAt <= now) buckets.delete(bucketKey);
      });
    }
    const key = `${scope}:${clientAddress(request)}`;
    const existing = buckets.get(key);
    const bucket =
      !existing || existing.expiresAt <= now
        ? { count: 0, expiresAt: now + windowMs }
        : existing;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.setHeader("RateLimit-Limit", String(maxRequests));
    response.setHeader(
      "RateLimit-Remaining",
      String(Math.max(0, maxRequests - bucket.count))
    );
    response.setHeader(
      "RateLimit-Reset",
      String(Math.ceil(bucket.expiresAt / 1000))
    );
    if (bucket.count > maxRequests) {
      response
        .status(429)
        .json({ error: "Too many requests. Please wait and retry." });
      return;
    }
    next();
  };
}
