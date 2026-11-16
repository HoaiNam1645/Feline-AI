import { createHash } from "node:crypto";
import { Request } from "express";

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export function requestMetadata(request: Request): RequestMetadata {
  const forwarded = request.headers["x-forwarded-for"];
  const realIp = request.headers["x-real-ip"];
  const rawIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0]?.trim() || (Array.isArray(realIp) ? realIp[0] : realIp) || request.ip;
  return {
    ipAddress: rawIp?.slice(0, 128) || null,
    userAgent: request.headers["user-agent"]?.slice(0, 500) || null
  };
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookie(
  name: string,
  token: string,
  maxAgeSeconds: number,
  secure: boolean
): string {
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.trunc(maxAgeSeconds))}`
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
