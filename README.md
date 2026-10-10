# Bowling liga Lenart

Vite + React. Sezona 2026/2027 (13 ekip) in testna 2025/2026 (12 ekip, 22 krogov).

Predaja vzdrževalcu spletne strani: **`PREDAJA.md`**.

Živo: https://bowling-lenart.vercel.app  
Koda: https://github.com/mihav3212-dev/bowling-liga

## Zagon

```bash
npm install
npm run dev
```

Testi: `npm test`.

V `.env.local` (glej `.env.example`): `ADMIN_PASSWORD`, po želji `DATABASE_URL`.

Brez baze so sezone v `localStorage`. Z Neon/Vercel Postgres so skupne za vse obiskovalce.

## Admin

Prijava zgoraj desno. Nova sezona ne arhivira tekoče. **Zaključi sezono** samo, ko so vse tekme vnesene.

JSON je varnostna kopija. Razpored: koledar (žreb) na zavihku Ekipe ali CSV v Adminu.

## Točkovanje

Jedro: `src/lib/scoring.ts`.

- Sestava A1–A4 / B1–B4 (rezerva 5–6).
- Male točke T: dvoboj 2 / 1; +220/+240; ženske +8, BZS −8.
- Velike točke: krog 2 / 1 / 0 po seštevku T, plus 2 za več kegljev na tekmi.
- TOČKE tekme: 2 / 1 / 0 po primerjavi velikih.
