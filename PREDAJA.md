# Predaja: Bowling liga Lenart

Aplikacija **ni WordPress vtičnik**. Teče ločeno na lastnem strežniku (Node + MySQL). Na bowlinglenart.si je treba samo povezati zavihek **Liga**.

| Kaj | Naslov |
|-----|--------|
| Ciljni naslov | https://liga.bowlinglenart.si |
| Koda | mapa `bowling-liga` (GitHub ali kopija) |

Koda je mapa `bowling-liga` (brez `node_modules` in `.env`).

---

## 1. WordPress — zavihek Liga

V meniju (Videz → Meniji) vnos **Liga** nastavi na:

`https://liga.bowlinglenart.si`

Če naj stari URL še deluje, dodaj 301:

`https://bowlinglenart.si/liga/` → `https://liga.bowlinglenart.si`

Datotek aplikacije **ne** kopiraš v WordPress. PHP strani `/liga/` ni treba spreminjati, razen preusmeritve ali povezave v meniju.

---

## 2. DNS — poddomena

Pri DNS za `bowlinglenart.si`:

| Tip | Ime | Vrednost |
|-----|-----|----------|
| A | liga | IP tvojega strežnika |

SSL (Let's Encrypt) nastavi na tem strežniku, npr. certbot pred nginx.

---

## 3. Strežnik in baza (obvezno za klub)

Aplikacija potrebuje **Node.js 20+**. phpMyAdmin je samo za MySQL, ne požene React/Node kode. Primer nginx: `deploy/nginx.conf.example`, systemd: `deploy/bowling-liga.service`.

Brez baze vsi rezultati ostanejo **samo v brskalniku** tistega računalnika.

Da vsi vidijo iste sezone in rezultate:

1. Na računalniku, kjer imaš že vneseno sezono: Admin → **Izvozi JSON**.
2. V phpMyAdmin ustvari prazno bazo (npr. `bowling_liga`). `schema.sql` ni obvezen.
3. `npm install`, `npm run build`, `npm start` (ali systemd). Datoteke `.env` ne rabiš.
4. Odpri stran — prvi obisk pokaže **Namestitev**: MySQL gostitelj/uporabnik/geslo/baza in geslo admina. Shrani.
5. Prijavi se in Admin → **Uvozi JSON kot sezono**.

Tabele `seasons` in `settings` nastanejo ob namestitvi. Povezava se shrani v `data/config.json` (ni v Gitu). Admin geslo je v tabeli `settings` (`admin_password`) — kasneje ga spremeniš v phpMyAdmin.

Če je treba namestitev ponoviti, na strežniku zbriši `data/config.json`.

**Brez koraka 1 se lokalni vnosi ob vklopu baze ne prenesejo sami.**

Lokalni zagon: `npm install` in `npm run dev`. Če ni namestitve, sezone ostanejo v brskalniku.

---

## 4. Kaj vidi obiskovalec

Zgoraj: logotip, prijava admina, sonce/luna (svetla/temna tema).

**Sezona** — izbira tekoče in arhiviranih sezon.

Zavihki:

- **Razpored** — kola, dnevi, ure, ekipe (brez točk).
- **Rezultati** — kola v spustnem meniju; tekme (TOČKE, velike točke, keglji) in najboljši rezultati tistega tedna. Klik na tekmo odpre zapisnik (samo ogled).
- **Lestvica** — ekipe: Iger, Z, P, R, velike točke, male točke, povprečja, TOČKE.
- **Igralci** — posamezna lestvica.

PDF izvoz (rezultati, lestvica, igralci) je na zavihkih po izpisu.

---

## 5. Admin — dnevno delo

Prijava zgoraj desno. Meni **Admin**.

### Vnos tekme

1. Razpored ali Rezultati → klik na tekmo.
2. Sestava A1–A4 (rezerva A5–A6) in B1–B4 (B5–B6).
3. Keglji po dvobojih. Rumeni kvadratki T so male točke dvoboja.
4. Na dnu je seštevek kegljev, povprečja, velikih točk in rezultata. **Shrani** te vrne na seznam (podatki se sicer shranjujejo sproti).

### Točkovanje (kot uradni zapisnik)

- **Male točke (T):** zmaga dvoboja 2, remi 1; bonus za 220/240; ženske +8 kegljev, član BZS −8.
- **Velike točke:** vsak krog 2 / 1 / 0 po seštevku rumenih T; na koncu +2 ekipi z več keglji.
- **TOČKE (rezultat tekme):** 2 : 0 ali 1 : 1 po primerjavi velikih točk.

### Sezone

- **Nova sezona** odpre prazno sezono **poleg** obstoječih. Ne arhivira ničesar.
- **Zaključi sezono** je aktiven samo, ko so **vse tekme izpolnjene**. Potem je sezona arhiv (samo branje).
- **Odpri sezono** vrne arhiv v urejanje (npr. če je bila zaprta prekmalu).
- Pripravljena sezona 2026/27 (13 ekip) in 2025/26 (12 ekip, 22 krogov) sta na zavihku **Ekipe**, dokler razpored še ni sestavljen.

Opomba 2025/26, 3. kolo (četrtek 6. 11. 2025): na PDF sta pri 18:00 in 19:30 obakrat navedena MOBICOM. V aplikaciji sta **KLASMETAL – FRIZERSTVO SIJAJ** in **MOBICOM – BAR 10**.

### Nov razpored / 2. del

Na **Ekipah**, ko so ekipe vnesene:

- **Sestavi razpored** — koledar: označi igralne dni (ponavadi sreda in četrtek). Termini 18:00, 19:30, 21:00. Sistem naredi žreb.
- Če v istem tednu označiš **pon.–pet.**, je to počitniški teden (liga ne igra, na razporedu se izpiše pavza).
- **Žreb 2. dela** — ko je 1. del v razporedu: zamenjava domačin/gost, dan in ura se premešata.

Druga možnost: **Admin → Uvozi razpored (CSV)** (podpičje je varnejše):

```
kolo;datum;ura;domači;gostje;opomba
2;21.10.2026;18:00;KLASMETAL;SAUBERMACHER;28.–29. oktober 2026 — prost teden
```

Pavza: opomba pri zadnjem kolu pred premorom, ali vrstica samo `kolo;opomba`. Imena ekip morajo biti enaka kot v sezoni.

Če manjkajo uradna kola že vnesene sezone: **Dodaj preostali razpored**.

### Varnostna kopija

- **Izvozi JSON** — varnostna kopija cele sezone.
- **Uvozi JSON kot sezono** — doda sezono poleg obstoječih (po vklopu baze pride v skupno shrambo). Ni vnos posamezne tekme.
- Redno shrani JSON, dokler ni vklopljena skupna baza.

---

## 6. Kaj vzdrževalec ne rabi

- Kopirati mape v `wp-content`.
- Spreminjati točkovanja v kodi (`src/lib/scoring.ts`), razen če se spremenijo klubska pravila.
- Commitati `.env.local` ali gesla.
