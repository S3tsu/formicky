# FormičkyHub

Procvičování organické a analytické chemie pro studenty farmacie: názvosloví, reakce, mechanismy, syntézy, důkazy iontů, spektra, testy a Herna.

Web: https://s3tsu.github.io/formicky/

Celá aplikace je jeden soubor `index.html`, jen 3D souřadnice molekul jsou zvlášť v `m3d.json` (načtou se až při otevření 3D modelu) a `count.js` je vlastní kopie skriptu statistik GoatCounter (licence ISC). Adresy, na které stránka smí posílat data a ze kterých načítá skripty, určuje Content-Security-Policy v hlavičce `index.html`; při změně kódu GoatCounter nebo formuláře hlášení je potřeba ji upravit. Pokrok se ukládá v prohlížeči (localStorage), přenést ho jde kódem zálohy na úvodní stránce.
