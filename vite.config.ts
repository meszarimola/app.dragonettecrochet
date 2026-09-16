/*
 * Vite-beállítások (PQW-903).
 *
 * A verziószám build időben ég be: a `package.json` `version` mezője kerül a
 * `__APP_VERSION__` konstansba, amit a felület a sarokban kiír. Így a kiírt
 * szám nem tud elcsúszni a kiadástól, és kézzel írt verzió sehol nincs a
 * forrásban. A többi beállítás a Vite alapértelmezése: a gyökér a repó, a
 * kimenet a `dist/`, a statikus fájlok a `public/` alól jönnek.
 */

import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8')) as { readonly version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
