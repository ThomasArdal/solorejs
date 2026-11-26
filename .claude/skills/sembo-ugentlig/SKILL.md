---
name: sembo-ugentlig
description: Opdaterer SoloRejs' Sembo-rejser (fly+hotel til udlandet) ved at køre solo-søgninger (1 voksen) hos sembo.dk i Chrome, finde billigste afrejsedag i priskalenderen og skrive den ind i data/trips.json. Kør lokalt, fx hver mandag. Bruges ved "kør Sembo", "ugentlig Sembo-opdatering".
---

# Ugentlig Sembo-opdatering

Sembos priser står ikke i sidens tekst, men hentes dynamisk. Derfor kører denne skill lokalt i Chrome (`mcp__claude-in-chrome__*`), og ikke i det natlige cloud-job (som springer operator "Sembo" over).

**Kun udlandet.** Rejser til Danmark må ikke tilføjes. Kandidater med `country: "Danmark"` springes over.

## Forudsætninger
- Miljøvariabel `ADTRACTION_TOKEN` (Adtraction API-nøgle). Den må aldrig skrives i repoet eller i svar. Tjek kun, at den er sat (`[ -n "$ADTRACTION_TOKEN" ]`), og vis aldrig værdien.
- Indlæs Chrome-værktøjerne med ét `ToolSearch`-kald: `tabs_context_mcp, tabs_create_mcp, tabs_close_mcp, navigate, computer, javascript_tool, browser_batch`.
- Kandidater: `tools/sembo-candidates.json` (id, sku, name, country, tripType, packageType, nights, pageUrl). Kun disse må oprettes. Nye destinationer: slå deres `sku` op i Adtraction-feedet (`destination:<nr>`, se `tools/adtraction-discover.mjs`) og tilføj dem til filen (id = `sembo-<slug>-fly-hotel`, `pageUrl` uden `affiliate-id`).

## Kandidater (38)
- **22 eksisterende** (oprettet og opdateret hver uge): Rom, Barcelona, Gran Canaria, Lissabon, Athen, Rhodos, Porto, Funchal, Mallorca, Wien, Kraków, Dubrovnik, Paris, Amsterdam, London, Berlin, Istanbul, Antalya, Dubai, Phuket, Bangkok, Venedig.
- **16 nye, tilføjet 2026-11-23 og endnu aldrig hentet** (første kørsel opretter dem, så de kræver `description`, `highlights` og `includes`, se "Skriv resultatet"):
  - Citytrips, 3 nætter: Milano, Nice, Edinburgh, Stockholm, Oslo, Bergen, Gdańsk, Salzburg, Split, Marseille, Hamborg, München.
  - Solferie, 7 nætter: Korfu, Koh Samui, Krabi, Tenerife (Arona).
- Ved første kørsel af de nye: tjek at destinationsfeltet på Sembo-siden faktisk viser den rigtige by (især "Arona" for Tenerife, hvor hotellerne skal ligge i det sydlige Tenerife). Koh Samui og Krabi har lange fly (kan lande dagen efter, evt. omstigning). Er der ingen brugbar pris for en ny destination, så spring den over og skriv det i rapporten.
- 38 destinationer er en lang kørsel (ca. 5-6 browserkald pr. stk.). Kør dem gerne i hold (fx de 22 eksisterende og de 16 nye hver for sig) og gem observationer i scratchpad efter hver 2.-3. destination, så en afbrudt forbindelse ikke koster alt.

## Princip: billigste afrejsedag
For hver kandidat søger du én gang (afrejse = dagens dato + 21 dage, `nights` fra kandidaten), og så vælger du **den billigste afrejsedag i priskalenderen**. Den dag er rejsen, der skrives ind. Kun dage fra og med dagens dato + 14 dage tæller.

## Pr. kandidat (brug `pageUrl` uden `affiliate-id`, så testbesøg ikke tæller som klik)
Åbn en ny fane og naviger til `pageUrl`. Vent ca. 4 s. Luk popup'en og vælg fanen via JS:
`[...document.querySelectorAll('button')].filter(b=>/got it/i.test(b.textContent)).forEach(b=>b.click())` og `[...document.querySelectorAll('[role=tab]')].find(e=>/Fly \+ hotel/.test(e.textContent)&&e.offsetParent).click()`.

1. **Afrejsested:** København (CPH) er normalt forudfyldt (`?airport=CPH` i `pageUrl`). Tjek det i zoom'et (se 3).
2. **Datoer:** Klik på *Hvornår?*. Kalenderen er et interval: klik afrejsedagen og derefter hjemrejsedagen (afrejse + `nights`). Tjek at feltet viser "(N nætter)". Tryk *Færdig*.
3. **Rejsende:** Klik på rejsende-feltet, tryk minus ved Voksne, til der står **1 voksen**, tryk *Færdig*, derefter *Søg*. Verificér med et zoom, at felterne er rigtige (destination, datoer, "N nætter", "1 voksen"), FØR du søger.

   **Rækkefølge der virker, og som kan samles i én `browser_batch`** (verificeret 2026-11-23 på alle 22; zoom'et midt i batchen læser du bagefter): (a) `navigate`, vent 4 s, JS for popup og fane, (b) klik rejsende-feltet, minus, *Færdig*, (c) klik *Hvornår?*, vent 1 s, klik afrejse og hjemrejse, (d) zoom `[380,200,1180,320]`, (e) kalender-*Færdig*, *Søg*, vent 9-10 s, JS der parser priskalenderen (se 5).

   **Koordinater** (skærmbilledets koordinatsystem er 1568×726, også selv om vinduet er 1920 bredt; de passede 2026-11-23, men tag et skærmbillede først, hvis noget ser anderledes ud): rejsende-felt (950,285), minus (948,398), rejsende-*Færdig* (993,500), *Hvornår?* (558,288), kalender-*Færdig* (1103,708), *Søg* (1115,288). Kalenderen viser to måneder; ugens kolonner (man-søn) ligger ved x = 808, 842, 877, 910, 945, 978, 1013, og rækkerne ved y = 532 (første viste uge i den højre måned), 567 (næste uge), 600 (derefter). Eksempel 2026-11-23: dec. 14 = (808,532), dec. 17 = (910,532), dec. 18 = (945,532), dec. 19 = (978,532), dec. 21 = (808,567). Rækkerne flytter sig, når måneden skifter (fra 1. dec. viser kalenderen dec. + jan.), så tag et skærmbillede af kalenderen første gang hver kørsel og regn derfra.
4. **Vent 9-10 s.** Resultatsiden har en priskalender øverst. Mens den indlæser, er priserne grå pladsholdere (Dubai, Phuket og Antalya var langsomme): giver parsen i 5 en tom liste, så vent 8 s mere og prøv igen, før du tror, at der ikke er priser. Månedsfaner skifter måned. Efter skift skal du vente ca. 7 s.
5. **Find billigste dag** via JS: parse `document.body.innerText` (normalisér whitespace) med `/(\d{1,2})\.\s*(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\.?\s*([\d.]+)\s*kr/gi`, regn dag og måned om til en dato, og filtrér til datoer ≥ dagens dato + 14. Kig også i næste måned, hvis vinduet krydser månedsskift. "Laveste pris" i overskriften kan referere til en dag uden for vinduet, så brug den ikke. Tjek også `location.href.match(/day=[\d-]+/)`: den viser, hvilken dag siden har valgt (normalt afrejsedagen fra søgningen). JS må ikke læse hele `location.search`, det bliver blokeret; brug kun `.match(/day=.../)`.
6. **Vælg dagen:** Er den billigste dag ikke den valgte, så klik dens celle i priskalenderen **med musen** (JS `.click()` på cellen virker ikke). Båndet viser 15 dage omkring den valgte dag; cellerne ligger ved y≈172, og x ≈ 225 + 78·(antal dage fra den første viste dag), fx er første viste dag ved x≈225, den næste ved 305 osv. Er dagen uden for det synlige bånd (fx 22.-23. dec. når 14. dec. er valgt), så find labelen via JS (`[...document.querySelectorAll('*')].filter(e=>/^23\.\s*dec\./.test((e.innerText||'').trim())&&e.offsetParent)`, kortest tekst først), kald `scrollIntoView({inline:'center',block:'nearest'})`, og tag et skærmbillede: cellen ligger nu ved x≈777, y≈172. Vent 8-9 s og tjek at URL'en har `day=<den billigste dag>` og at "Samlet pris" matcher kalenderen. Aflæs bagefter med ét JS-kald:
   `const t=document.body.innerText.replace(/\s+/g,' '); const i=t.indexOf('Fly Se andre'); (t.match(/([\d.]+) kr\. Samlet pris/)||[])[1]+' || '+t.slice(i,i+1000)`
   - samlet pris, antal nætter og datoer ("Rom, Italien, 3 nætter, ons. 16 - lør. 19 dec. 2026")
   - flyselskab, tider, "Direkte flyvning" eller "1 omstigning" (ud og hjem kan være forskellige), "Dette fly ankommer den ..."
   - hotelnavn, bedømmelse (+ antal vurderinger), bydel, værelsestype ("Enkeltværelse", "Dobbelt- eller tosengsværelse til enkeltbrug", "Room for 2+1" er IKKE enkeltværelse), forplejning, afbestillingsvilkår ("Ingen tilbagebetaling" / "Gratis afbestilling frem til ...").

Brug aldrig *Fortsæt til booking*, og indtast ingen personlige oplysninger. Luk fanen, når du er færdig.

## Hvis aflæsningen fejler
Spring kandidaten over og skriv den som "kunne ikke aflæses". Opdater aldrig en rejse med en pris, du ikke har set. Brug ikke `read_network_requests` eller URL-parametre til at udlede interne API'er. Mister Chrome-forbindelsen midt i en batch, så gentag ikke handlingen blindt: kald `tabs_context_mcp` og se, hvor siden står.

## Skriv resultatet
1. Skriv en observationsfil i scratchpad (ikke i repoet):
   `[{ "id", "price" (tal), "departureDate", "nights", "hotelName", "roomType", "board", "flight", "checkedDate", "description", "highlights", "includes" }]`
   `board` skal være en af: Ingen måltider | Morgenmad | Halvpension | Helpension | All inclusive | Ukendt (sembo-upsert.mjs mapper ellers fx "Morgenmad inkluderet" til "Morgenmad", og alt umappeligt til "Ukendt").
   Andre felter (fx `cancellation`, `rating`) ignoreres af scriptet, men er nyttige at have, når du skriver tekster.
   `departureDate` er afrejsedagen for flyet (langdistancefly til Thailand og Dubai lander dagen efter, hotellet starter så den dag). `nights` er hotelnætter.
2. **Tekster.** `description/highlights/includes` er nødvendige for nye rejser. For eksisterende rejser skal du **sammenholde de nuværende tekster med det, du har set**, og rette alt, der ikke længere passer: nyt hotel, direkte fly vs. omstigning, værelsestype, forplejning, om afbestilling er gratis, bedømmelse. (2026-11-23 var det 13 af 22: bl.a. Phuket stod som direkte, men havde 1 omstigning.) Dansk, egne ord, kun fakta du har set på siden. Skriv ikke noget om bydel, transport, køkken eller lignende, medmindre det stod på siden (fx "aparthotel" er set, "eget køkken" er ikke). Afbestilling beskrives som "frem til få dage før afrejse", medmindre fristen ligger mere end ca. en uge før.
3. Kør `node tools/sembo-upsert.mjs <fil>` med `ADTRACTION_TOKEN` sat. Scriptet opretter/opdaterer pr. stabilt id, sætter `sourceUrl` til Adtraction-trackinglinket og `soloType: "soegepris"`, og sætter `imageUrl` (headerbillede) fra feedet. `fetch-images.mjs` og natjobbet rører ikke rejser med `imageUrl`. Kør `node tools/sembo-upsert.mjs --images`, hvis du kun vil opdatere billeder. Tekster til eksisterende rejser (`description`, `highlights`, `includes`) overskrives kun, hvis de står i observationsfilen.
4. Kør `node tools/build.mjs`. Hashen på `styles.css`/`app.js` er normaliseret mod linjeskift, så et build på Windows giver samme resultat som nattejobbet (ellers ændres alle sider).
5. Rapportér: oprettet / prisændringer (gammel → ny, inkl. ny afrejsedato) / tekster rettet / sprunget over. Vis nye og ændrede tekster, før du committer.
6. Commit til `main`, når brugeren har set rapporten og bekræfter. Kør `git pull --rebase` før push: nattejobbet kan have merget en PR. Opstår der konflikter i genererede filer (`index.html`, `rejse/*/index.html`, `sitemap.xml`), så løs dem ved at tage `data/trips.json` som den er flettet og køre `node tools/build.mjs` igen, ikke ved at redigere HTML i hånden.

## Vigtigt
- Priserne svinger fra gang til gang (samme dag kunne give 1.997 kr. ved ét opslag og 3.821 kr. ved det næste), så de er et øjebliksbillede. Beskrivelsen siger det, og siden viser "Pris tjekket <dato>".
- Afrejsedato i fortiden fjernes ikke automatisk. Kør skillen ugentligt, så datoerne holdes frem.
- Nye rejser tæller med i det samlede antal (68 pr. 2026-11-23, 84 hvis alle 16 nye oprettes).
