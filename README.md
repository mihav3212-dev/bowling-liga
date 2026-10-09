# Bowling liga

Enostavna lokalna aplikacija za vodenje Bowling lige Lenart (sezona 2026/2027: 13 ekip; testna 2025/2026: 12 ekip).

Predaja vzdrževalcu spletne strani: glej `PREDAJA.md` (zavihek Liga → poddomena).

## Zagon

```bash
npm install
npm run dev
```

Odpri naslov, ki ga izpiše Vite (ponavadi `http://localhost:5173`).

Testi pravil: `npm test`.

Brez `DATABASE_URL` ostanejo podatki v brskalniku (`localStorage`).

Z `DATABASE_URL` (Neon / Vercel Postgres) so rezultati skupni za vse obiskovalce. Staro sezono arhiviraš v **Urejanje sezone**. Arhiv je samo za branje.

Vnos je za admina: v `.env.local` in na Vercelu nastavi `ADMIN_PASSWORD`. Prijava in odjava sta zgoraj desno. Bazo dodaš v Vercel (Storage → Postgres) in povežeš `DATABASE_URL`.

## Pravila

- Ekipa ima neomejeno članov; pred tekmo izbereš 4 igralce + do 2 menjavi.
- Male točke: dvoboj (2 / 1). Seštevek igralcev odloči tekmo. Točke ekipe: zmaga 2, remi 1, poraz 0.
- **Izvozi PDF** in **Izvozi/uvozi podatke** sta v admin razdelku po prijavi. JSON je za prenos lige na drug računalnik.
- 4 krogi: vsak domač igralec proti vsakemu gostu, vsakič na drugi stezi.
- Dvoboj: zmaga 2 točki, remi 1:1.
- Nad 220 kegljev +1, nad 240 +2 (po pribitku/odbitku).
- Ženske +8 kegljev, član BZS −8.
- Več malih točk = 2 veliki točki; izenačeno = 1:1.

Jedro točkovanja je v `src/lib/scoring.ts`.
