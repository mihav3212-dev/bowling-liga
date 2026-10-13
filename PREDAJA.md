# Predaja: Bowling liga Lenart

Aplikacija **ni WordPress vtičnik**. Teče v `public_html` (HTML + PHP + MySQL). Na bowlinglenart.si je treba samo povezati zavihek **Liga**.

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

Pri DNS za `bowlinglenart.si` usmeri `liga` na isti hosting kot spletno stran (A ali CNAME po navodilih ponudnika). SSL naj uredi DirectAdmin/cPanel.

---

## 3. public_html in baza

Node na strežniku **ni** potreben.

1. Na računalniku: `git clone`, `npm install`, `npm run build`.
2. Vsebino mape **`dist/`** naloži v **`public_html`** (vključno z `index.html`, `assets/`, `api/`, `.htaccess`).
3. V phpMyAdmin ustvari prazno bazo (npr. `bowling_liga`).
4. Odpri domeno → obrazec **Namestitev** (MySQL gostitelj/uporabnik/geslo/baza + admin geslo).
5. Če imaš staro sezono: Admin → **Izvozi JSON** (lokalno), na hostingu **Uvozi JSON kot sezono**.

Tabele nastanejo ob namestitvi. Povezava je v `data/config.json`. Admin geslo je v `settings` (`admin_password`). Ponovna namestitev: zbriši `data/config.json`.

**Shramba:** ena MySQL baza, dve tabeli. `seasons` — vsaka sezona je ena vrstica, v `data` je JSON (ekipe, igralci, razpored, rezultati, treningi, gesla ekip, dovoljenja). `settings` — admin geslo. Ni ločenih tabel za tekme.

Brez MySQL se shrani samo v **ta brskalnik**. Vercel brez baze je samo ogled, ne skupna liga.

`.htaccess` je v `dist/` skrit (Finder: Cmd+Shift+.). Mora iti na hosting, sicer SPA in `/api` ne delujeta.

Če se namestitev ne pokaže, preveri da je `.htaccess` naložen in da Apache dovoljuje Rewrite.

Lokalni zagon: `npm install` in `npm run dev`.

---

## 4. Kaj vidi obiskovalec

Zgoraj: logotip, **eno polje za geslo** (admin ali ekipa), sonce/luna (svetla/temna tema).

**Sezona** — izbira tekoče in arhiviranih sezon.

Zavihki:

- **Razpored** — kola, dnevi, ure, ekipe (brez točk). Zgoraj je poudarek **V živo** / **Naslednja**.
- **Rezultati** — kola v spustnem meniju; tekme (TOČKE, velike točke, keglji) in najboljši rezultati tistega tedna. Klik na tekmo odpre zapisnik (samo ogled).
- **Lestvica** — ekipe: Iger, Z, P, R, velike točke, male točke, povprečja, TOČKE.
- **Igralci** — posamezna lestvica.

PDF izvoz (rezultati, lestvica, igralci) je na zavihkih po izpisu.

---

## 5. Ekipe — prijava in dovoljenja

Isto polje zgoraj desno: admin geslo ali geslo ekipe.

### Geslo ekipe

1. Admin → **Ekipe** → izbrana ekipa → **Prijava ekipe**.
2. **Nastavi geslo**. Geslo se shrani zgoščeno; admin ga ne vidi nazaj.
3. Če ekipa pozabi geslo: admin vpiše **novo** (starega ni treba). **Odstrani prijavo** jim vzame dostop.

### Dovoljenja

Samo v **Admin → Dovoljenja ekip** (ni zavihka). Za vsako ekipo:

| Dovoljenje | Kaj sme ekipa |
|------------|----------------|
| Vnos igralcev v ekipo | Svoj seznam članov **do začetka 2. kola**. Potem samo admin. |
| Vnos igralcev na tekmo | Sestava A1–A6 ali B1–B6 na **svojih** tekmah (privzeto vklopljeno). Rezultatov ne vnaša. |
| Vnos rezultatov | Prvi vpis kegljev na svojih tekmah. |
| Popravljanje rezultatov | Sprememba že vpisanih kegljev. |
| Urejanje sezone | Žreb, vse ekipe — **pusti izklopljeno**. |

Brez kljukice ekipa vidi javni razpored, rezultate in lestvico. **Treningi** so na dnu zavihka **Ekipe** — vsaka ekipa vidi samo svoje igralce.

Žreb 2. dela in izvoz vseh prijavnih listov sta samo za admina (razen če ekipi daš urejanje sezone).

---

## 6. Admin — dnevno delo

Prijava zgoraj desno. Meni **Admin** (dovoljenja ekip, sezone, JSON, razpored).

### Vnos tekme

1. Razpored ali Rezultati → klik na tekmo.
2. Sestava A1–A4 (rezerva A5–A6) in B1–B4 (B5–B6). Ko so v 1. krogu keglji, je sestava zaklenjena.
3. Keglji po dvobojih. Rumeni kvadratki T so male točke dvoboja.
4. Na dnu je seštevek kegljev, povprečja, velikih točk in rezultata. **Shrani** te vrne na seznam (podatki se sicer shranjujejo sproti).

Ekipa z dovoljenjem za sestavo na razporedu odpre **samo svojo** tekmo in vpiše A1–A6 ali B1–B6, brez kegljev.

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
- Redno shrani JSON, dokler ni vklopljena skupna baza. Ko je MySQL vklopljen, je to dovolj za skupno ligo; JSON je še vedno varnostna kopija.

---

## 7. Pred prvim kolo (checklist)

1. Hosting: `dist/` v `public_html`, MySQL, namestitev, admin geslo.
2. WordPress meni **Liga** → `https://liga.bowlinglenart.si`.
3. Ekipe: gesla + dovoljenja (sestava vklopljena, urejanje sezone izklopljeno).
4. Preizkus: prijava ene ekipe → razpored → sestava; admin reset gesla; telefon (razpored, igralci).
5. Izvoz JSON.

---

## 8. Kaj vzdrževalec ne rabi

- Kopirati mape v `wp-content`.
- Spreminjati točkovanja v kodi (`src/lib/scoring.ts`), razen če se spremenijo klubska pravila.
- Commitati `.env.local` ali gesla.
