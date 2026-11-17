---
name: sembo-ugentlig
description: Opdaterer SoloRejs' Sembo-rejser (fly+hotel til udlandet) ved at køre solo-søgninger (1 voksen) hos sembo.dk i Chrome, finde billigste afrejsedag i priskalenderen og skrive den ind i data/trips.json. Kør lokalt, fx hver mandag. Bruges ved "kør Sembo", "ugentlig Sembo-opdatering".
---

# Ugentlig Sembo-opdatering

Sembos priser står ikke i sidens tekst, men hentes dynamisk. Derfor kører denne skill lokalt i Chrome (`mcp__claude-in-chrome__*`), og ikke i det natlige cloud-job (som springer operator "Sembo" over).

**Kun udlandet.** Rejser til Danmark må ikke tilføjes. Kandidater med `country: "Danmark"` springes over.

## Forudsætninger
- Miljøvariabel `ADTRACTION_TOKEN` (Adtraction API-nøgle). Den må aldrig skrives i repoet eller i svar.
- Indlæs Chrome-værktøjerne med ét `ToolSearch`-kald: `tabs_context_mcp, tabs_create_mcp, tabs_close_mcp, navigate, computer, javascript_tool, browser_batch`.
- Kandidater: `tools/sembo-candidates.json` (id, sku, name, country, tripType, packageType, nights, pageUrl). Kun disse må oprettes. Nye destinationer: slå deres `sku` op i Adtraction-feedet (`tools/adtraction-discover.mjs`).

## Princip: billigste afrejsedag
For hver kandidat søger du én gang (afrejse = dagens dato + 21 dage, `nights` fra kandidaten), og så vælger du **den billigste afrejsedag i priskalenderen**. Den dag er rejsen, der skrives ind. Kun dage fra og med dagens dato + 14 dage tæller.

## Pr. kandidat (brug `pageUrl` uden `affiliate-id`, så testbesøg ikke tæller som klik)
Åbn en ny fane og naviger til `pageUrl`. Vent ca. 3 s. Luk popup'en og vælg fanen via JS:
`[...document.querySelectorAll('button')].filter(b=>/got it/i.test(b.textContent)).forEach(b=>b.click())` og `[...document.querySelectorAll('[role=tab]')].find(e=>/Fly \+ hotel/.test(e.textContent)&&e.offsetParent).click()`.

1. **Afrejsested:** København (CPH) er normalt forudfyldt. Ellers skriv "Kobenhavn" i *Fra lufthavn* og vælg *København, Kastrup (CPH)*.
2. **Datoer:** Klik på *Hvornår?*. Kalenderen er et interval: klik afrejsedagen og derefter hjemrejsedagen (3 nætter = 8. → 11.). Tjek at feltet viser "(N nætter)". Tryk *Færdig*.
3. **Rejsende:** Åbn `[data-e2e=pax-selection-button]` via JS, tryk minus ved Voksne til der står **1 voksen**, tryk *Færdig*, derefter *Søg*. Verificér med et zoom, at felterne er rigtige, FØR du søger. Klik aldrig blindt i en lang batch: layout skifter, og et forkert klik kan ændre destinationen.

   **Rækkefølge der virker:** (a) naviger, vent 3,5 s, luk popup, vælg fanen og åbn rejsende-vælgeren i ét JS-kald, (b) minus + *Færdig*, (c) åbn *Hvornår?*, vent 1 s, klik afrejse og hjemrejse, *Færdig*, (d) zoom for at tjekke "N nætter" og "1 voksen", (e) *Søg*. Koordinater (viewport 1568×772, kun vejledende; tag skærmbillede først): rejsende-minus (950,398), rejsende-Færdig (995,500), *Hvornår?* (558,288), dec. 8 (842,497), dec. 11 (945,497), dec. 15 (842,530), kalender-Færdig (1103,708), Søg (1115,288).
4. **Vent 8 s.** Resultatsiden har en priskalender øverst for hele måneden. Månedsfaner ("November 2026", "December 2026") skifter måned. Efter skift skal du vente ca. 7 s, før priserne er indlæst.
5. **Find billigste dag** via JS: parse `document.body.innerText` (normalisér whitespace) med `/(\d{1,2})\.\s*dec\.\s*([\d.]+)\s*kr/gi`, og filtrér til dage ≥ dagens dato + 14. Kig også i næste måned, hvis vinduet krydser månedsskift. "Laveste pris" i overskriften kan referere til en dag uden for vinduet, så brug den ikke.
6. **Vælg dagen:** Når du skifter måned, vælger siden selv en dag (URL'en får `day=...`). Er den billigste dag ikke valgt, så klik dens celle i kalenderen **med musen** (JS `.click()` på cellen virker ikke). Cellerne ligger øverst i et bånd ved y≈172; for dec. 1–15 er x≈ 225 + 78·(dag−1) (fx 5. dec. = 540, 9. dec. = 855, 14. dec. = 1247). Ligger dagen uden for det synlige bånd (fx 23. dec.), så find cellen via JS (`div` hvis tekst starter med fx `23. dec. 4.053 kr`), kald `scrollIntoView({inline:'center'})`, læs `getBoundingClientRect()` og klik på midten × (1568 / innerWidth) (typisk 0,8167). Vent ca. 8 s og tjek at URL'en har `day=<den billigste dag>` og at "Samlet pris" er faldet til forventet beløb. Aflæs bagefter:
   - samlet pris (`kr. Samlet pris for rejsen`), antal nætter og datoer ("Rom, Italien, 3 nætter, tor. 3 – søn. 6 dec.")
   - flyselskab, tider, "Direkte flyvning", evt. at hjemflyvningen lander næste dag
   - hotelnavn, bedømmelse, værelsestype ("Enkeltværelse", "Standard double for single use"), forplejning, afbestillingsvilkår.

Brug aldrig *Fortsæt til booking*, og indtast ingen personlige oplysninger.

## Hvis aflæsningen fejler
Spring kandidaten over og skriv den som "kunne ikke aflæses". Opdater aldrig en rejse med en pris, du ikke har set. Brug ikke `read_network_requests` eller URL-parametre til at udlede interne API'er.

## Skriv resultatet
1. Skriv en observationsfil i scratchpad (ikke i repoet):
   `[{ "id", "price" (tal), "departureDate", "nights", "hotelName", "roomType", "board", "flight", "checkedDate", "description", "highlights", "includes" }]`
   `description/highlights/includes` er kun nødvendige for nye rejser, men skal opdateres, hvis hotellet er skiftet (fx morgenmad er ikke længere med). Dansk, egne ord, kun fakta du har set på siden. Skriv ikke noget om bydel, transport, køkken eller lignende, medmindre det stod på siden (fx "aparthotel" er set, "eget køkken" er ikke). Dubrovnik 4 nætter = 8.→12. dec., Dubai 5 nætter = 8.→13., 7 nætter = 8.→15. Langdistancefly (Phuket, Bangkok, Dubai) lander dagen efter. `departureDate` er afrejsedagen for flyet.
2. Kør `node tools/sembo-upsert.mjs <fil>` med `ADTRACTION_TOKEN` sat. Scriptet opretter/opdaterer pr. stabilt id, sætter `sourceUrl` til Adtraction-trackinglinket og `soloType: "soegepris"`, og sætter `imageUrl` (headerbillede) fra feedet. `fetch-images.mjs` og natjobbet rører ikke rejser med `imageUrl`. Kør `node tools/sembo-upsert.mjs --images`, hvis du kun vil opdatere billeder.
3. Kør `node tools/build.mjs`.
4. Rapportér: oprettet / prisændringer (gammel → ny, inkl. ny afrejsedato) / sprunget over. Commit til `main`, når brugeren har set rapporten og bekræfter.

## Vigtigt
- Priserne svinger fra gang til gang (samme dag kunne give 1.997 kr. ved ét opslag og 3.821 kr. ved det næste), så de er et øjebliksbillede. Beskrivelsen siger det, og siden viser "Pris tjekket <dato>".
- Afrejsedato i fortiden fjernes ikke automatisk. Kør skillen ugentligt, så datoerne holdes frem.
