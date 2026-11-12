# Testy Posturálního profilu

End-to-end testy celé aplikace v prohlížeči Chromium nastaveném jako iPhone (390×844, dotyk, 3× hustota). Prochází úvod, formulář pacienta, fotoaparát s falešnými senzory vodováhy, sérii snímků, umisťování bodů P1–P8, výpočet POTSI/ATSI, ukládání do karty, kartu pacienta, prohlížeč fotek, souhrn, porovnání, export, zálohu a obnovu, mazání a zátěž (desítky snímků).

Spuštění z kořene repozitáře:

```
bash tests/run.sh
```

Na konci se vypíše `N/N prošlo`. Každá nová verze se vydává až po úspěšném průchodu všech testů.

- `back.jpg`, `tilted.jpg` – uměle nakreslené testovací postavy (žádné fotky pacientů).
- `.www/`, `.out/` – dočasné soubory testů, do repozitáře se neukládají.
- Testy používají háček `window.__t`, který `run.sh` vloží jen do testovací kopie aplikace; vydaná aplikace ho neobsahuje.
