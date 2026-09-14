# Mérési lap — próbadarab

Egy próbadarabhoz egy lap. Nyomtasd ki, vagy másold le a „Lap” részt, és
töltsd ki szerkesztőben. A mezők mellett `ilyen betűvel` az adatfájlbeli név
áll: ezt nem kell kitölteni, az átírást segíti.

## Első kör: mit horgolj

A **leggyakrabban használt fonallal és tűvel**. Egy sor = egy próbadarab = egy
lap.

| # | Öltés | Forma | Méret |
|---|---|---|---|
| 1 | rövidpálca (rp) | síkban | legalább 15 cm széles, 20 sor |
| 2 | rövidpálca (rp) | csőben | 30 öltés körben, legalább 14 kör |
| 3 | félpálca (fp) | síkban | legalább 15 cm széles, legalább 14 sor |
| 4 | félpálca (fp) | csőben | 30 öltés körben, legalább 14 kör |
| 5 | egyráhajtásos pálca (erp) | síkban | legalább 15 cm széles, legalább 14 sor |
| 6 | egyráhajtásos pálca (erp) | csőben | 30 öltés körben, legalább 14 kör |
| 7 | kétráhajtásos pálca (krp) | síkban | legalább 15 cm széles, legalább 14 sor |
| 8 | kétráhajtásos pálca (krp) | csőben | 30 öltés körben, legalább 14 kör |
| 9 | láncszem (lsz) | láncszemsor | 30 láncszem |
| 10 | rövidpálca hátsó szálba (hsz) | síkban | mint az 1. |

- A cső helyett lehet **5 körös lapos kör** is (6, 12, 18, 24, 30 öltés), de a
  cső a pontosabb. Ha van időd, horgold meg mindkettőt: a kör azt is
  megmutatja, hogy lapos marad-e.
- A kétráhajtásos pálcás darab magas lesz. Ha 14 sor túl sok, mérj kevesebb
  sort, és írd be, hányat mértél.
- **Szaporítás és fogyasztás:** ehhez még nincs mérési módszer, előbb
  beszéljük meg.
- **Később:** második és harmadik fonal, egy tűmérettel kisebb és nagyobb tű.

## A mérés szabályai

Minden lapnál ugyanígy:

1. **Középen mérj.** Minden széltől legalább 2 öltés és 2 sor maradjon ki.
   Csőnél a körváltás vonalától is maradj távol.
2. **Laposan fekvő, nem nyújtott darabon** mérj, mindig ugyanazzal az
   eszközzel.
3. **Csőnél** fektesd laposra, és az egyik oldalán mérd a 10 öltést; a hajtás
   ne essen bele.
4. **Háromszor mérj**, a középső rész három különböző helyén. Mind a hármat
   írd be, ne az átlagot.
5. **Milliméterben** írd, tizedesvesszővel (pl. `58,5`).
6. Ha a három érték között **3 mm-nél nagyobb** a különbség, mérj egy
   negyediket is, és a megjegyzésbe írd, hol volt az eltérés.
7. **Blokkolás után** csak teljesen száraz darabot mérj.
8. **Fotó:** felülről, cm-es vágóalátéten, mindig ugyanakkora magasságból; a
   darab színe és visszája is. Fájlnév:
   `<azonosító>-<elotte|utana>-<szin|visszaje>.jpg`, például
   `GS-20260915-01-utana-szin.jpg`.
9. **Tömeg:** blokkolás után, száraz darabon mérd; a mérleg pontosságát is írd
   fel. Blokkolás előtt nem kötelező.

---

## Lap

**Azonosító** `id`: GS-__________-____ (dátum ÉÉÉÉHHNN, aznapi sorszám)

**Dátum** `date`: ________________

**Horgoló** `crocheter.id`: ________________
  **Kéz** `crocheter.handedness`: ☐ jobb `right` ☐ bal `left`

### 1. Fonal `yarn`

| Mező | Érték | Kulcs |
|---|---|---|
| Rövid név, ékezet nélkül (pl. marka-termek) | | `id` |
| Márka | | `brand` |
| Termékvonal | | `line` |
| Szín | | `colour` |
| Festési tétel | | `dyeLot` |
| Összetétel (anyag és %) | | `fibre` |
| Vastagsági kategória a címkén (0–7) | | `cycWeight` |
| Címke: hossz és tömeg | ______ m / ______ g | `label.lengthM`, `label.massG` |
| Címke: ajánlott tű | ______ – ______ mm | `label.hookMmMin`, `label.hookMmMax` |

### 2. Tű `hook`

| Mező | Érték | Kulcs |
|---|---|---|
| Méret a tűre nyomva | ______ mm | `mm` |
| Márka | | `brand` |
| Anyag | ☐ alumínium `aluminium` ☐ acél `steel` ☐ bambusz `bamboo` ☐ fa `wood` ☐ műanyag `plastic` ☐ egyéb `other` | `material` |

### 3. Öltés `stitch`

**Öltés** `stitch.id`:
☐ láncszem (lsz) `ch`
☐ kúszószem (ksz) `slst`
☐ rövidpálca (rp) `sc`
☐ félpálca (fp) `hdc`
☐ egyráhajtásos pálca (erp) `dc`
☐ kétráhajtásos pálca (krp) `tr`

**Beszúrás** `stitch.insertion`:
☐ mindkét szálba `both-loops`
☐ hátsó szálba (hsz) `back-loop`
☐ első szálba `front-loop`

### 4. Forma `construction`

**Hogyan készült** `workedIn`:
☐ síkban, sorokban `rows`
☐ csőben, körökben `rounds-tube`
☐ lapos kör `rounds-flat`
☐ láncszemsor `chain`

**Síkban:**

| Mező | Érték | Kulcs |
|---|---|---|
| Kezdőlánc (láncszem) | | `foundationChains` |
| Sorok száma | | `rows` |
| Fordulólánc (láncszem) | | `turningChain.chains` |
| A fordulólánc számít öltésnek? | ☐ igen `true` ☐ nem `false` | `turningChain.countsAsStitch` |

**Csőben vagy lapos körben:**

| Mező | Érték | Kulcs |
|---|---|---|
| Kezdés | ☐ varázskör `magic-ring` ☐ láncgyűrű `chain-ring` | `start` |
| Körzárás | ☐ spirál `spiral` ☐ zárt kör `joined` | `roundJoin` |
| Körök száma | | `rounds` |
| Csőnél: öltés körönként | | `stitchesPerRound` |
| Lapos körnél: az utolsó kör öltésszáma | | `lastRoundStitches` |

**Láncszemsor:**

| Mező | Érték | Kulcs |
|---|---|---|
| Láncszemek száma | | `chains` |

### 5. Mérés blokkolás előtt `measurements[0]`, `state: unblocked`

**Mérőeszköz** `tool`: ☐ vonalzó `ruler` ☐ tolómérő `calliper` ☐ mérőszalag `tape`

**Síkban vagy csőben** `grid`:

| | 1. | 2. | 3. | (4.) | Kulcs |
|---|---|---|---|---|---|
| 10 öltés szélessége (mm) | | | | | `widthMm` |
| 10 sor magassága (mm) | | | | | `heightMm` |

Ha nem 10 öltést vagy 10 sort mértél — öltés: ______ `stitchesSpanned`,
sor: ______ `rowsSpanned`

**Lapos kör** `circle`:

| | 1. | 2. | 3. | (4.) | Kulcs |
|---|---|---|---|---|---|
| Átmérő, három irányban (mm) | | | | | `diameterMm` |

**Forma** `shape`: ☐ lapos `flat` ☐ kunkorodik, csészésedik `cupping` ☐ fodros `ruffling`

**Láncszemsor** `chain`:

| | 1. | 2. | 3. | (4.) | Kulcs |
|---|---|---|---|---|---|
| A teljes sor hossza (mm) | | | | | `lengthMm` |

**Az egész darab** `swatch`:

| Mező | Érték | Kulcs |
|---|---|---|
| Szélesség (csőnél laposra fektetve) | ______ mm | `widthMm` |
| Magasság | ______ mm | `heightMm` |
| Tömeg (nem kötelező) | ______ g | `massG` |
| A mérleg pontossága | ______ g | `scaleResolutionG` |

**Fotók** `photos`:
☐ színe `rs` — fájl: ________________________________
☐ visszája `ws` — fájl: ________________________________

**Megjegyzés** `notes`:

&nbsp;

### 6. Blokkolás `measurements[1].blocking`

| Mező | Érték | Kulcs |
|---|---|---|
| Módja | ☐ nedves `wet` ☐ gőz `steam` ☐ permet `spray` | `method` |
| Száradási idő | ______ óra | `dryHours` |
| Tűzve száradt? | ☐ igen `true` ☐ nem `false` | `pinned` |

### 7. Mérés blokkolás után `measurements[1]`, `state: blocked`

**Mérőeszköz** `tool`: ☐ vonalzó `ruler` ☐ tolómérő `calliper` ☐ mérőszalag `tape`

**Síkban vagy csőben** `grid`:

| | 1. | 2. | 3. | (4.) | Kulcs |
|---|---|---|---|---|---|
| 10 öltés szélessége (mm) | | | | | `widthMm` |
| 10 sor magassága (mm) | | | | | `heightMm` |

Ha nem 10 öltést vagy 10 sort mértél — öltés: ______ `stitchesSpanned`,
sor: ______ `rowsSpanned`

**Lapos kör** `circle`:

| | 1. | 2. | 3. | (4.) | Kulcs |
|---|---|---|---|---|---|
| Átmérő, három irányban (mm) | | | | | `diameterMm` |

**Forma** `shape`: ☐ lapos `flat` ☐ kunkorodik, csészésedik `cupping` ☐ fodros `ruffling`

**Láncszemsor** `chain`:

| | 1. | 2. | 3. | (4.) | Kulcs |
|---|---|---|---|---|---|
| A teljes sor hossza (mm) | | | | | `lengthMm` |

**Az egész darab** `swatch`:

| Mező | Érték | Kulcs |
|---|---|---|
| Szélesség (csőnél laposra fektetve) | ______ mm | `widthMm` |
| Magasság | ______ mm | `heightMm` |
| Tömeg | ______ g | `massG` |
| A mérleg pontossága | ______ g | `scaleResolutionG` |

**Fotók** `photos`:
☐ színe `rs` — fájl: ________________________________
☐ visszája `ws` — fájl: ________________________________

**Megjegyzés** `notes`:

&nbsp;

### 8. Körülmények `context`

| Mező | Érték | Kulcs |
|---|---|---|
| Napszak | ☐ reggel `morning` ☐ délután `afternoon` ☐ este `evening` ☐ éjjel `night` | `timeOfDay` |
| Fáradtság (1 = friss, 5 = nagyon fáradt) | | `fatigue` |
| Feszesség, szokatlan dolgok | | `tensionNotes` |

### 9. Megjegyzés `notes`

&nbsp;

---

Adatfájlba átírva: ☐ — dátum: ____________ fájl: GS-__________-____.json
