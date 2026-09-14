# Tesztdarab-jegyzőkönyv

Minden ütemtervi lépés végén a tervező generál egy kis mintát, te megcsinálod,
és összevetjük a darabot azzal, amit a program előre megmondott. Egy
tesztdarabhoz egy jegyzőkönyv.

A mezők mellett `ilyen betűvel` az adatfájlbeli név áll: ezt nem kell
kitölteni, az átírást segíti.

## Menete

1. **Horgolás előtt** a fejlesztés kitölti az 1–3. részt: a mintát, az anyagot
   és a jóslatot. Állapot: `predicted`.
2. **Horgolás közben** jegyzeteld, hol tértél el a leírástól, és mi volt nehezen
   érthető (5. rész).
3. **A kész darabon** mérj háromszor, írd be a formát, és fotózd le (4. rész).
   Állapot: `measured`.
4. **Együtt** kiszámoljuk az eltérést, és minden eltérésről döntünk (6. rész).
   Állapot: `evaluated`.

**Tűréshatár:** a mért átlag legfeljebb **±5%**-kal térhet el a jósolt
mérettől. Minden eltérésből kalibráció, új szabály vagy szövegjavítás lesz.

A mérés szabályai ugyanazok, mint a [mérési lapon](meresi-lap.md#a-mérés-szabályai):
laposan, nyújtás nélkül, háromszor, milliméterben, fotó cm-es vágóalátéten.

---

## Jegyzőkönyv

**Azonosító** `id`: WE-______

**Dátum** `date`: ________________

**Állapot** `status`: ☐ jósolva `predicted` ☐ lemérve `measured` ☐ kiértékelve `evaluated`

**Horgoló** `crocheterId`: ________________

**Ütemtervi lépés** `roadmapStep.milestone`: ________________
  **Ticket** `roadmapStep.ticket`: PQW-______

**Mit vizsgál** `purpose`:

&nbsp;

### 1. Minta `pattern`

| Mező | Érték | Kulcs |
|---|---|---|
| Megnevezés | | `title` |
| Forrás | ☐ a tervező generálta `generated` ☐ kézzel írt `manual` | `source` |
| A tervező verziója vagy commitja | | `designerVersion` |
| Mintafájl | | `file` |
| Rövid leírás | | `summary` |

### 2. Anyag és gauge-profil `materials`

| Mező | Érték | Kulcs |
|---|---|---|
| Fonal (a mérési lap rövid neve) | | `yarnId` |
| Tű | ______ mm | `hookMm` |
| Gauge-profil | ______ ☐ nincs, a jóslat becslés | `gaugeProfileId` |

### 3. Jóslat `predictions`

| Méret | Kulcs `dimension` | Jósolt (mm) `valueMm` | Tartomány (mm) `rangeMm` | Honnan `basis` |
|---|---|---|---|---|
| | | | ______ – ______ | ☐ mért profil `measured` ☐ címke `label` ☐ becslés `estimated` |
| | | | ______ – ______ | ☐ mért profil `measured` ☐ címke `label` ☐ becslés `estimated` |
| | | | ______ – ______ | ☐ mért profil `measured` ☐ címke `label` ☐ becslés `estimated` |

Gyakori kulcsok: átmérő `diameter`, magasság `height`, szélesség `width`,
kerület `circumference`.

**Jósolt forma** `predictedShape`: ☐ lapos `flat` ☐ kunkorodik `cupping` ☐ fodros `ruffling` ☐ egyéb `other`

### 4. A kész darab `measurements`

| Méret `dimension` | Állapot `state` | 1. | 2. | 3. | Átlag (számolt) | Eltérés % (számolt) | ±5%-on belül? |
|---|---|---|---|---|---|---|---|
| | ☐ blokkolás előtt `unblocked` ☐ után `blocked` | | | | | | ☐ igen ☐ nem |
| | ☐ blokkolás előtt `unblocked` ☐ után `blocked` | | | | | | ☐ igen ☐ nem |
| | ☐ blokkolás előtt `unblocked` ☐ után `blocked` | | | | | | ☐ igen ☐ nem |

Az átlagot és az eltérést nem kell az adatfájlba írni, a program számolja:
eltérés % = (átlag − jósolt) ÷ jósolt × 100.

**Forma** `shape`: ☐ lapos `flat` ☐ kunkorodik, csészésedik `cupping` ☐ fodros `ruffling` ☐ egyéb `other`

**A forma leírása** `shapeNotes`:

&nbsp;

**Tömeg** `massG`: ______ g

**Fotók** `photos`:

| Fájl `file` | Mit mutat `caption` |
|---|---|
| | |
| | |

### 5. Horgolás közben

**Hol tértél el a leírástól?** `deviations`

| Hol (sor, kör) `where` | Mit csináltál másképp `what` | Miért `why` |
|---|---|---|
| | | |
| | | |

**Mennyire volt érthető?** `clarity` (1 = nem értettem, 5 = teljesen világos)

| Sor, kör `where` | 1–5 `rating` | Megjegyzés `note` |
|---|---|---|
| | | |
| | | |

### 6. Döntés az eltérésekről `actions`

| Melyik eltérés `about` | Döntés `kind` | Hivatkozás `ref` | Megjegyzés `note` |
|---|---|---|---|
| | ☐ kalibráció `calibration` ☐ új szabály `rule` ☐ szövegjavítás `text-fix` ☐ nincs teendő `none` | | |
| | ☐ kalibráció `calibration` ☐ új szabály `rule` ☐ szövegjavítás `text-fix` ☐ nincs teendő `none` | | |

Hivatkozás: szabály (`R-…`), ticket (`PQW-…`) vagy próbadarab (`GS-…`).

### 7. Megjegyzés `notes`

&nbsp;

---

Adatfájlba átírva: ☐ — dátum: ____________ fájl: WE-______.json
