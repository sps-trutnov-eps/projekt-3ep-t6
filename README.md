# Dice Game

Webová hra Farkle (kostková hra) pro jednoho nebo dva hráče, postavená na Node.js a Express.

## Technologie

- Node.js, Express
- EJS šablony
- PostgreSQL
- Session-based autentizace

## Spuštění

1. Nainstaluj závislosti:
```bash
npm install
```

2. Nastav připojení k databázi v `db.js`

3. Spusť server:
```bash
node app.js
```

Server běží na `http://localhost:3000`

## Pravidla hry

Cíl je jako první dosáhnout 10 000 bodů. Hráč hází až 6 kostkami a vybírá kombinace, které přinášejí body:

| Kombinace | Body |
|---|---|
| Jednička | 100 |
| Pětka | 50 |
| Tři jedničky | 1000 |
| Tři stejné (2–6) | číslo x 100 |
| Každá další stejná | zdvojnásobení |
| Postupka 1–6 | 1500 |
| Postupka 2–6 | 750 |
| Postupka 1–5 | 500 |

Pokud hráč hodí a žádná kostka nepřinese body, přijde o všechny body v daném kole (Farkle). Pokud hráč využije všechny kostky, získá nových 6 a může pokračovat v kole (Hot Dice).

## Herní módy

**Singleplayer** — hra proti jednoduchému NPC, které vždy hodí jednou a bankuje.

**Multiplayer** — hra pro dva hráče ve společné místnosti. Hráč vytvoří místnost a sdílí kód, nebo se připojí kódem od kamaráda. Podporuje také náhodné párování s veřejnou místností a pozvání přátel přímo ze seznamu přátel.

## Funkce

- Singleplayer a multiplayer herní módy
- Systém přátel a pozvánky ke hře
- Globální žebříček hráčů se statistikami výher, proher a sérií
- Wildcard kostka
- Systém streaks
