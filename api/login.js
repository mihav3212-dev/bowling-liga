import { cookieHeader, isSecureRequest, passwordOk, signToken } from "./session.mjs";

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  try {
    const body = await readBody(req);
    if (!passwordOk(body.password)) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.setHeader("Set-Cookie", cookieHeader(signToken(), isSecureRequest(req)));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  } catch {
    res.statusCode = 400;
    res.end();
  }
}
