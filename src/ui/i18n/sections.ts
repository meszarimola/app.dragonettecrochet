// KB: interface.md §53

import type { StitchSectionId } from '../../core/stitches.ts';
import type { Dictionary } from '../i18n.ts';

export interface SectionTexts {
  readonly palette: {
    readonly titles: Readonly<Record<StitchSectionId, string>>;
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
  },
};

export const SECTION_TEXTS = { hu, en } satisfies Dictionary<SectionTexts>;
