import { readToken, tokenValid } from "./session.mjs";

export default function handler(req, res) {
  const ok = tokenValid(readToken(req.headers.cookie));
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ admin: ok }));
}
