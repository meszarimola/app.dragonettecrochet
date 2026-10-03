// KB: interface.md §53, §86

import type { Shaping, StitchSectionId } from '../../core/stitches.ts';
import type { Dictionary } from '../i18n.ts';

export interface SectionTexts {
  readonly palette: {
    readonly titles: Readonly<Record<StitchSectionId, string>>;
    readonly shapingPart: Readonly<Record<Shaping, string>>;
  };
}

const hu: SectionTexts = {
  palette: {
    titles: {
      basic: 'Alapszemek',
      'increase-decrease': 'Szaporítás és fogyasztás',
      compound: 'Összetett szemek',
      structure: 'Láncív és varázskör',
    },
    shapingPart: {
      decrease: 'A fogyasztás szeme',
      increase: 'A szaporítás szeme',
    },
  },
};

const en: SectionTexts = {
  palette: {
    titles: {
      basic: 'Basic stitches',
      'increase-decrease': 'Increases and decreases',
      compound: 'Compound stitches',
      structure: 'Chain space and magic ring',
    },
    shapingPart: {
      decrease: 'Decrease stitch',
      increase: 'Increase stitch',
    },
  },
};

export const SECTION_TEXTS = { hu, en } satisfies Dictionary<SectionTexts>;
