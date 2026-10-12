function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(buf));
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return `${salt}:${await sha256Hex(salt + plain)}`;
}

export async function verifyPassword(plain: string, stored: string | undefined): Promise<boolean> {
  if (!plain || !stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return (await sha256Hex(salt + plain)) === hash;
}
