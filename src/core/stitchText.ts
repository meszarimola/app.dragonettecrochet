/*
 * A szemek kiírt neve és szerkezete a három jelölésben.
 *
 * Kimenetben csak a `name` és az `abbr` jelenik meg, az `aliases` soha
 * (01 §8.5 szabály 25). Rövidítés nélküli szemnél a név kiírva szerepel
 * (szókészlet D4, D8). A brit szöveg ugyanabból a szerkezetből készül, mint az
 * amerikai, csak a részszemek brit nevével, így az egy fokos eltolás az
 * összetett szemekre is érvényes (01 §3.1).
 */

import { stitchById } from './stitches.ts';
import type { GroupStitchDef, JoinedStitchDef, Locale, StitchDef } from './types.ts';

/** „rövidpálca (rp)”; rövidítés nélkül csak a név. */
export function stitchName(def: StitchDef, locale: Locale): string {
  const { name, abbr } = def.terms[locale];
  return abbr ? `${name} (${abbr})` : name;
}

/** A név és, ha van, a szerkezet: „szaporítás: 2 rp egy szembe”. */
export function stitchLabel(def: StitchDef, locale: Locale): string {
  const structure = stitchStructure(def, locale);
  return structure ? `${stitchName(def, locale)}: ${structure}` : stitchName(def, locale);
}

/**
 * Az összetett szem szerkezete, pl. „2 rp egy szembe”, „sc2tog”,
 * „(dc, ch 1, dc) in same st”. Alapszemnél `null`, és a pufnál is: az nem
 * részszemekből, hanem felhúzott hurkokból áll, a neve elég.
 */
export function stitchStructure(def: StitchDef, locale: Locale): string | null {
  if (def.kind === 'group') return groupStructure(def, locale);
  if (def.kind === 'joined') return joinedStructure(def, locale);
  return null;
}

const IN_SAME_STITCH: Readonly<Record<Locale, string>> = {
  hu: 'egy szembe',
  'en-US': 'in same st',
  'en-GB': 'in same st',
};

/** Hivatkozás egy részszemre: a rövidítés, ha van, különben a név. */
function ref(def: StitchDef, locale: Locale): string {
  const { name, abbr } = def.terms[locale];
  return abbr ?? name;
}

function groupStructure(def: GroupStitchDef, locale: Locale): string {
  // Az egymást követő azonos tagok egy tételbe kerülnek: „5 erp”, „1 lsz”.
  const runs: { def: StitchDef; count: number }[] = [];
  for (const id of def.members) {
    const last = runs.at(-1);
    if (last?.def.id === id) last.count += 1;
    else runs.push({ def: stitchById(id), count: 1 });
  }

  const parts = runs.map(({ def: member, count }) => {
    // Angolul a lánc „ch 1” alakú (01 §8.5 szabály 26), magyarul „1 lsz”.
    if (member.kind === 'chain' && locale !== 'hu') return `${ref(member, locale)} ${count}`;
    if (member.kind === 'chain' || count > 1) return `${count} ${ref(member, locale)}`;
    return ref(member, locale);
  });

  const body = parts.length > 1 ? `(${parts.join(', ')})` : parts.join('');
  return `${body} ${IN_SAME_STITCH[locale]}`;
}

function joinedStructure(def: JoinedStitchDef, locale: Locale): string | null {
  if (def.closure === 'loops') return null;

  const part = stitchById(def.part);
  const n = def.parts;

  if (def.base === 'same') return `${n} ${ref(part, locale)} ${IN_SAME_STITCH[locale]}`;
  if (locale === 'hu') return `${n} ${ref(part, locale)} ${n} szemen át`;

  // CYC: sc2tog, dc3tog; rövidítés nélkül kiírva.
  const { name, abbr } = part.terms[locale];
  return abbr ? `${abbr}${n}tog` : `${n} ${name} together`;
}
