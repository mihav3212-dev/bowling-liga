import { useEffect } from "react";
import { beatPresence } from "./leagueApi";
import { presenceKind, viewerId } from "./presence";

const BEAT_MS = 30_000;

/** Javni utrip. Admin številke bere posebej. */
export function usePresenceHeartbeat() {
  useEffect(() => {
    const id = viewerId();
    let lastKind = "";
    let lastSent = 0;
    let stopped = false;

    const send = (force: boolean) => {
      const kind = presenceKind(window.location.search);
      const now = Date.now();
      if (!force && kind === lastKind && now - lastSent < BEAT_MS - 5_000) return;
      lastKind = kind;
      lastSent = now;
      void beatPresence(id, kind).catch(() => {
        if (!stopped) lastSent = 0;
      });
    };

    send(true);
    const timer = window.setInterval(() => send(false), 2_000);
    const onShow = () => {
      if (document.visibilityState === "visible") send(true);
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("popstate", onShow);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("popstate", onShow);
    };
  }, []);
}
