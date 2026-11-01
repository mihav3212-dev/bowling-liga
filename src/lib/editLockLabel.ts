const DEVICE_NICK_KEY = "bowling-liga-device-nick";

/** Kratka oznaka te naprave/brskalnika — en admin, več telefonov. */
export function deviceNick(): string {
  try {
    const existing = localStorage.getItem(DEVICE_NICK_KEY)?.trim();
    if (existing) return existing.slice(0, 24);
    const nick = Math.random().toString(36).slice(2, 6).toUpperCase();
    localStorage.setItem(DEVICE_NICK_KEY, nick);
    return nick;
  } catch {
    return "???";
  }
}

/** Npr. „Admin · A3F2“ ali „Lenart · K9Q1“. */
export function matchEditLockLabel(role: string): string {
  const base = role.trim() || "Nekdo";
  return `${base} · ${deviceNick()}`;
}
