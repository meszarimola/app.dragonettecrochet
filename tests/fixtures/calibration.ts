/*
 * A docs/calibration/examples/ kitalált mérései a gauge-tesztekhez.
 */

import { readFileSync } from 'node:fs';

import { buildGaugeProfiles, loadGaugeSample } from '../../src/core/gauge-profile.ts';

export const ROWS_EXAMPLE = 'gauge-sample.rows.example.json';
export const TUBE_EXAMPLE = 'gauge-sample.rounds-tube.example.json';
export const WORKED_EXAMPLE = 'worked-example.example.json';

export function exampleText(name: string): string {
  return readFileSync(new URL(`../../docs/calibration/examples/${name}`, import.meta.url), 'utf8');
}

export function exampleJson(name: string) {
  return JSON.parse(exampleText(name));
}

/** A betöltött minták; hibánál kivétel, hogy a teszt ne egy későbbi ponton bukjon el. */
export function samplesFrom(...texts: string[]) {
  return texts.flatMap((text) => {
    const result = loadGaugeSample(text);
    if (!result.ok) throw new Error(`${result.error.path}: ${result.error.message}`);
    return result.samples;
  });
}

/** A két példafájl profiljai: `…-blocked` (csak sík) és `…-unblocked` (sík és cső). */
export function exampleProfiles() {
  const profiles = buildGaugeProfiles(samplesFrom(exampleText(ROWS_EXAMPLE), exampleText(TUBE_EXAMPLE)));
  const byId = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
  return {
    profiles,
    unblocked: byId['owner-pelda-pamut-125-4mm-unblocked'],
    blocked: byId['owner-pelda-pamut-125-4mm-blocked'],
  };
}
