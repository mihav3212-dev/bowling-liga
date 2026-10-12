# Bowling liga Lenart

Vite + React + Node. Teče na lastnem strežniku (Node 20+ in MySQL/MariaDB). Ni vezano na Vercel.

Predaja vzdrževalcu spletne strani: **`PREDAJA.md`**.

## Lokalno

```bash
npm install
npm run dev
```

V `.env.local` (glej `.env.example`): `ADMIN_PASSWORD` in MySQL podatki.

Testi: `npm test`.

Brez MySQL so sezone v `localStorage` (samo ta brskalnik). Z bazo so skupne za vse.

## Strežnik

```bash
npm install
npm run build
npm start
```

Nginx primer: `deploy/nginx.conf.example`. Systemd: `deploy/bowling-liga.service`.

phpMyAdmin: ustvari bazo, uvozi `schema.sql` (ali pusti, da tabela nastane ob prvem zagonu). Nato v `.env` vpiši `MYSQL_*`.

## Admin

Prijava zgoraj desno. Nova sezona ne arhivira tekoče. **Zaključi sezono** samo, ko so vse tekme vnesene.

JSON je varnostna kopija. Razpored: koledar (žreb) na zavihku Ekipe ali CSV v Adminu.

## Točkovanje

Jedro: `src/lib/scoring.ts`.

- Sestava A1–A4 / B1–B4 (rezerva 5–6).
- Male točke T: dvoboj 2 / 1; +220/+240; ženske +8, BZS −8.
- Velike točke: krog 2 / 1 / 0 po seštevku T, plus 2 za več kegljev na tekmi.
- TOČKE tekme: 2 / 1 / 0 po primerjavi velikih.
