# Predaja: Bowling liga na bowlinglenart.si

Aplikacija **ni WordPress vtičnik**. Teče ločeno (trenutno Vercel). Na obstoječi strani je treba samo povezati zavihek **Liga**.

Živa aplikacija: https://bowling-lenart.vercel.app  
Ciljni naslov: **https://liga.bowlinglenart.si**

Koda: mapa `bowling-liga` (brez `node_modules` in `.env.local`).

---

## 1. WordPress — zavihek Liga

V meniju (Videz → Meniji) vnos **Liga** nastavi na zunanji naslov:

`https://liga.bowlinglenart.si`

Namesto `/liga/` (ali `https://bowlinglenart.si/liga/`).

Če želiš, da stari URL še deluje: v WordPressu (ali pri gostovanju) dodaj preusmeritev 301:

`https://bowlinglenart.si/liga/` → `https://liga.bowlinglenart.si`

Do DNS spremembe lahko začasno povežeš na `https://bowling-lenart.vercel.app`.

---

## 2. DNS — poddomena

Pri registrarju / DNS za `bowlinglenart.si`:

| Tip   | Ime  | Vrednost              |
|-------|------|------------------------|
| CNAME | liga | `cname.vercel-dns.com` |

Nato v Vercel projektu **bowling-lenart** dodaj domeno `liga.bowlinglenart.si` (Settings → Domains). Počakaj na SSL.

---

## 3. Skupni podatki in izbira sezone

Zavihek **Sezona** je zgoraj za vse obiskovalce (tekoča in arhiv). Da vsi vidijo iste sezone:

1. V Vercel projektu: Storage → Create Database → Postgres (Neon).
2. Environment Variables: `DATABASE_URL` (in `ADMIN_PASSWORD`).
3. Redeploy. Shema `sql/schema.sql` se ustvari ob prvem klicu.

Brez baze ostanejo sezone v brskalniku (`localStorage`) — samo na tistem računalniku.

Admin se prijavi zgoraj desno. Geslo je samo v okoljskih spremenljivkah, ne v kodi.

---

## 4. Testna sezona 2025/26

Po prijavi: **Urejanje sezone** → **Napolni testno sezono 2025/26**.

Naloži 12 ekip in 11 krogov iz razporeda 2025/26 (1. krog). Rezultatov ni — vnesi jih kot pri tekoči sezoni.

Če je baza vklopljena: trenutno sezono najprej **arhiviraj**, potem napolni 2025/26 in vnesi lanske rezultate. Tekočo 2026/27 napolni z **Napolni sezono 2026/27** (nova trenutna sezona).

Opomba: v PDF pri 3. kolu (četrtek 6. 11. 2025) sta pri 18:00 in 19:30 obakrat navedena MOBICOM. V aplikaciji sta para **KLASMETAL – FRIZERSTVO SIJAJ** in **MOBICOM – BAR 10**.

---

## 5. Kaj vzdrževalec ne rabi

Datotek aplikacije **ne** kopiraš v WordPress (`wp-content`). PHP strani `/liga/` ni treba spreminjati, razen preusmeritve ali menjave povezave v meniju.
