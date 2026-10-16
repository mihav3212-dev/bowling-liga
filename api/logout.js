import { clearCookieHeader, isSecureRequest } from "./_lib/session.mjs";

export default function handler(req, res) {
  res.setHeader("Set-Cookie", clearCookieHeader(isSecureRequest(req)));
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
}
