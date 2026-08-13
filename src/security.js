const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  return new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
}

export function randomToken(size = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function secretsMatch(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const [a, b] = await Promise.all([sha256Hex(left), sha256Hex(right)]);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(/;\s*/)) {
    const splitAt = part.indexOf("=");
    if (splitAt > 0 && part.slice(0, splitAt) === name) return part.slice(splitAt + 1);
  }
  return null;
}

function cookieSecurity(request) {
  return new URL(request.url).protocol === "https:" ? "; Secure" : "";
}

export function cookieHeader(request, name, value, maxAge, sameSite = "Strict") {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${cookieSecurity(request)}`;
}

export function clearCookieHeader(request, name) {
  return `${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${cookieSecurity(request)}`;
}

export function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function createSignedPayload(secret, data) {
  const payload = toBase64Url(JSON.stringify(data));
  return `${payload}.${await hmacHex(secret, payload)}`;
}

export async function verifySignedPayload(secret, signed) {
  if (!secret || !signed) return null;
  const splitAt = signed.lastIndexOf(".");
  if (splitAt < 1) return null;
  const payload = signed.slice(0, splitAt);
  const signature = signed.slice(splitAt + 1);
  if (!(await secretsMatch(await hmacHex(secret, payload), signature))) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  } catch {
    return null;
  }
}
