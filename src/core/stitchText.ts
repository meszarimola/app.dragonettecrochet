// KB: 01 §3.1, 01 §4.4, 01 §8.5

import { stitchById } from './stitches.ts';
import type { GroupStitchDef, JoinedStitchDef, Locale, StitchDef } from './types.ts';

export function stitchName(def: StitchDef, locale: Locale): string {
  const { name, abbr } = def.terms[locale];
  return abbr ? `${name} (${abbr})` : name;
}

export function stitchLabel(def: StitchDef, locale: Locale): string {
  const structure = stitchStructure(def, locale);
  return structure ? `${stitchName(def, locale)}: ${structure}` : stitchName(def, locale);
}

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

function ref(def: StitchDef, locale: Locale): string {
  const { name, abbr } = def.terms[locale];
  return abbr ?? name;
}

function groupStructure(def: GroupStitchDef, locale: Locale): string {
  const runs: { def: StitchDef; count: number }[] = [];
  for (const id of def.members) {
    const last = runs.at(-1);
    if (last?.def.id === id) last.count += 1;
    else runs.push({ def: stitchById(id), count: 1 });
  }

  const parts = runs.map(({ def: member, count }) => {
    // KB: 01 §8.5 rule 26
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

  const { name, abbr } = part.terms[locale];
  return abbr ? `${abbr}${n}tog` : `${n} ${name} together`;
}
