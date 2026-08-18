import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "grok_pocket_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

function signingSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }
  return secret;
}

function signature(value) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function passwordIsConfigured() {
  return Boolean(process.env.APP_PASSWORD);
}

export function verifyPassword(password) {
  const expected = process.env.APP_PASSWORD;
  return Boolean(expected && password && safeEquals(password, expected));
}

export function createSession() {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = `v1.${expiry}`;
  return `${payload}.${signature(payload)}`;
}

export function verifySession(token) {
  if (!token) return false;

  const [version, expiry, providedSignature, ...rest] = token.split(".");
  if (version !== "v1" || !expiry || !providedSignature || rest.length > 0) return false;
  if (!/^\d+$/.test(expiry) || Number(expiry) < Math.floor(Date.now() / 1000)) return false;

  return safeEquals(providedSignature, signature(`${version}.${expiry}`));
}

export function sessionCookie(value, maxAge = SESSION_LIFETIME_SECONDS) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  };
}
