# 🏰 Sagnaturninn

Tölvuleikur til að læra óreglulegar sagnir í ensku.

## Hvernig á að spila
Tvísmelltu á **index.html** – leikurinn opnast í vafranum. Enginn server þarf.
(Ef þú vilt samt keyra hann á server: `npm start` og opna http://localhost:8080)

- **⚔️ Ævintýrið** – Galdramaðurinn klifrar upp 4 hæðir og berst við skrímsli. Hvert skrímsli spyr um
  Past Simple eða Past Participle, ýmist með valmöguleikum eða með því að skrifa svarið, stundum í setningu.
  Rangt svar kostar hjarta, og sögnin kemur aftur síðar. Á toppnum þarf að skrifa allar þrjár myndirnar
  til að sigra Sagnadrekann. 🐉
- **🃏 Æfingaspjöld** – snúa spjöldum og heyra framburð.
- **📖 Sagnabókin** – öll sagnatöflan með framburði og stjörnum sem sýna kunnáttu.

Leikurinn man hvaða sagnir barnið kann (í vafranum) og spyr oftar um þær sem eru erfiðastar.
Svörin eru lesin upp á ensku – hægt að slökkva á hljóði með 🔊 takkanum efst í horninu.
Lyklaborð: 1–4 velur valmöguleika, Enter staðfestir, bil snýr spjaldi.

## Leikmenn
Í upphafi er valið hvort **Styrmir** 🧙 eða **Garri** 🧝 spilar. Hvor um sig hefur sinn eigin sagnalista
og sína eigin framvindu (XP, stjörnur og sigra).

## Nýjar sagnir næsta dag
Opnaðu **verbs.js** og bættu línu í lista viðkomandi (`STYRMIR_VERBS` eða `GARRI_VERBS`).
Nýjum leikmanni er bætt við neðst í skránni undir `window.PLAYERS`.

```js
{ inf: "fly", past: "flew", pp: "flown", is: "að fljúga",
  sPast: "The bird ___ away.", sPp: "Have you ever ___ in a plane?" },
```

`wrongPast`, `wrongPp`, `sPast` og `sPp` eru valkvæð – leikurinn býr sjálfur til röng svör ef þau vantar.
