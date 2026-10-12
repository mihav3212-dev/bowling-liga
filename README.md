# Bowling liga Lenart

Vite + React. Na hostingu teče kot statična stran + **PHP** (public_html, phpMyAdmin). Node na strežniku ni potreben.

Predaja: **`PREDAJA.md`**.

## Lokalno

```bash
npm install
npm run dev
```

Testi: `npm test`.

## Na hosting (DirectAdmin / cPanel)

```bash
git clone https://github.com/mihav3212-dev/bowling-liga.git
cd bowling-liga
npm install
npm run build
```

Vsebino mape **`dist/`** naloži v **`public_html`** (index.html, assets, api, .htaccess — ne mape dist kot podmape).

V phpMyAdmin ustvari prazno bazo. Odpri domeno → **Namestitev** (MySQL podatki + admin geslo).
