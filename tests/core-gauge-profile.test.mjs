import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { buildGaugeProfiles, loadGaugeSample, profileId, stat, stitchKey } from '../src/core/gauge-profile.ts';
import { ROWS_EXAMPLE, TUBE_EXAMPLE, exampleJson, exampleProfiles, exampleText, samplesFrom } from './fixtures/calibration.ts';

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected} (±${epsilon})`);
}

function edited(name, change) {
  const file = exampleJson(name);
  change(file);
  return JSON.stringify(file);
}

function loadError(text) {
  const result = loadGaugeSample(text);
  assert.equal(result.ok, false);
  return result.error;
}

describe('mérési fájl betöltése (docs/calibration/)', () => {
  test('a sík példafájl mérésenként egy mintát ad: blokkolás előtt és után', () => {
    const [before, after] = samplesFrom(exampleText(ROWS_EXAMPLE));
    assert.equal(before.sampleId, 'GS-20260915-01');
    assert.equal(before.blocked, false);
    assert.equal(after.blocked, true);
    assert.equal(before.stitch, 'sc');
    assert.equal(before.workedIn, 'rows');
    assert.equal(before.hookMm, 4);
    assert.deepEqual(before.photoIds, ['GS-20260915-01-elotte-szin.jpg', 'GS-20260915-01-elotte-visszaje.jpg']);
    assert.match(before.notes, /Kitalált példaértékek/);
  });

  test('szemenkénti szélesség és sormagasság: az átlag osztva a lefedett szem- és sorszámmal', () => {
    const [before, after] = samplesFrom(exampleText(ROWS_EXAMPLE));
    near(before.widthMm.mean, 5.65);
    near(before.widthMm.sd, 0.05);
    assert.equal(before.widthMm.n, 3);
    near(before.heightMm.mean, 4.55);
    near(after.widthMm.mean, 5.7);
    near(after.heightMm.mean, 4.45);
    assert.deepEqual(before.drift, []);
  });

  test('területre jutó tömeg és szemenkénti fonal a mért tömegből és a címkéből', () => {
    const [before, after] = samplesFrom(exampleText(ROWS_EXAMPLE));
    assert.equal(before.massPerAreaGPerCm2, null);
    assert.equal(before.yarnPerStitchCm, null);
    near(after.swatchAreaCm2, 144.9);
    near(after.massPerAreaGPerCm2, 8.6 / 144.9);
    // g/cm² × szemterület (cm²) × 2,5 m/g × 100 cm/m
    near(after.yarnPerStitchCm, (8.6 / 144.9) * ((5.7 * 4.45) / 100) * 2.5 * 100);
  });

  test('a cső területe a kilapított szélesség kétszerese', () => {
    const [tube] = samplesFrom(exampleText(TUBE_EXAMPLE));
    assert.equal(tube.workedIn, 'rounds-tube');
    near(tube.widthMm.mean, 5.5);
    near(tube.heightMm.mean, 5);
    near(tube.swatchAreaCm2, (2 * 84 * 80) / 100);
    near(tube.massPerAreaGPerCm2, 9.5 / 134.4);
  });

  test('lapos kör: szélesség a kerületből, körmagasság a sugárból, terület az átmérőből', () => {
    const text = edited(TUBE_EXAMPLE, (file) => {
      file.construction = { workedIn: 'rounds-flat', start: 'magic-ring', roundJoin: 'spiral', rounds: 8, lastRoundStitches: 48 };
      const [measurement] = file.measurements;
      delete measurement.grid;
      measurement.circle = { diameterMm: [80, 81, 79], shape: 'cupping' };
      measurement.swatch = { widthMm: null, heightMm: null, massG: 4.1, scaleResolutionG: 0.1 };
    });
    const [circle] = samplesFrom(text);
    near(circle.widthMm.mean, (Math.PI * 80) / 48);
    near(circle.heightMm.mean, 5);
    near(circle.swatchAreaCm2, (Math.PI * 80 ** 2) / 400);
    assert.equal(circle.shape, 'cupping');
  });

  test('láncszemsor: láncszemenkénti hossz, és a profilban külön érték', () => {
    const text = edited(ROWS_EXAMPLE, (file) => {
      file.stitch = { id: 'ch', insertion: 'both-loops' };
      file.construction = { workedIn: 'chain', chains: 20 };
      file.measurements = [{ state: 'unblocked', blocking: null, tool: 'ruler', chain: { lengthMm: [100, 102, 98] } }];
    });
    const [chain] = samplesFrom(text);
    near(chain.chainLengthMm.mean, 5);
    assert.equal(chain.widthMm, null);
    const [profile] = buildGaugeProfiles([chain]);
    near(profile.chainLengthMm.mean, 5);
    assert.deepEqual(profile.perStitch, {});
  });

  test('a kalibrációs `slst` a könyvtár `sl-st` azonosítója lesz', () => {
    const [sample] = samplesFrom(edited(TUBE_EXAMPLE, (file) => (file.stitch.id = 'slst')));
    assert.equal(sample.stitch, 'sl-st');
  });

  test('5 %-nál nagyobb szórás a leolvasásokban figyelmeztetést ad (02 §3.1, §9 10.)', () => {
    const [sample] = samplesFrom(edited(TUBE_EXAMPLE, (file) => (file.measurements[0].grid.widthMm = [56, 57, 60])));
    assert.equal(sample.drift.length, 1);
    assert.equal(sample.drift[0].path, '$.measurements[0].grid.widthMm');
    near(sample.drift[0].spread, 4 / (173 / 3));
  });
});

describe('hibás mérési fájl', () => {
  test('érvénytelen JSON', () => {
    assert.equal(loadError('{"schemaVersion": 1,').code, 'invalid-json');
  });

  test('ismeretlen sémaverzió', () => {
    const error = loadError(edited(ROWS_EXAMPLE, (file) => (file.schemaVersion = 2)));
    assert.deepEqual([error.code, error.path], ['unsupported-version', '$.schemaVersion']);
  });

  test('hiányzó kötelező mező, mezőútvonallal', () => {
    const error = loadError(edited(ROWS_EXAMPLE, (file) => delete file.hook.mm));
    assert.deepEqual([error.code, error.path], ['invalid-format', '$.hook.mm']);
  });

  test('ismeretlen mező: az elírás nem vész el', () => {
    assert.equal(loadError(edited(ROWS_EXAMPLE, (file) => (file.megjegyzes = 'x'))).path, '$.megjegyzes');
    assert.equal(
      loadError(edited(ROWS_EXAMPLE, (file) => (file.measurements[0].grid.widthMM = [1, 2, 3]))).path,
      '$.measurements[0].grid.widthMM',
    );
  });

  test('a formához nem illő mérés', () => {
    const error = loadError(
      edited(ROWS_EXAMPLE, (file) => (file.measurements[0].circle = { diameterMm: [1, 2, 3], shape: 'flat' })),
    );
    assert.equal(error.path, '$.measurements[0].circle');
  });

  test('a formához kötelező szerkezeti adat hiányzik', () => {
    assert.equal(loadError(edited(TUBE_EXAMPLE, (file) => delete file.construction.rounds)).path, '$.construction.rounds');
  });

  test('háromnál kevesebb leolvasás', () => {
    const error = loadError(edited(ROWS_EXAMPLE, (file) => (file.measurements[0].grid.widthMm = [56, 57])));
    assert.equal(error.path, '$.measurements[0].grid.widthMm');
  });

  test('két mérésnél az első blokkolás előtti, a második utáni', () => {
    const error = loadError(edited(ROWS_EXAMPLE, (file) => file.measurements.reverse()));
    assert.equal(error.path, '$.measurements');
  });

  test('blokkolás előtti mérésnél nincs blokkolási mód', () => {
    const error = loadError(edited(ROWS_EXAMPLE, (file) => (file.measurements[0].blocking = { method: 'wet' })));
    assert.equal(error.path, '$.measurements[0].blocking');
  });

  test('a `ch` szem csak láncszemsorban', () => {
    assert.equal(loadError(edited(ROWS_EXAMPLE, (file) => (file.stitch.id = 'ch'))).path, '$.stitch.id');
  });
});

describe('profilok', () => {
  test('horgoló × fonal × tű × blokkolás szerint; a kulcsban a formák külön', () => {
    const { profiles, unblocked, blocked } = exampleProfiles();
    assert.deepEqual(
      profiles.map((profile) => profile.id),
      ['owner-pelda-pamut-125-4mm-blocked', 'owner-pelda-pamut-125-4mm-unblocked'],
    );
    assert.equal(profileId('owner', 'pelda-pamut-125', 3.5, false), 'owner-pelda-pamut-125-3.5mm-unblocked');
    assert.deepEqual(Object.keys(unblocked.perStitch.sc), ['rows', 'rounds-tube']);
    assert.deepEqual(Object.keys(blocked.perStitch.sc), ['rows']);
    assert.deepEqual(unblocked.samples, ['GS-20260915-01', 'GS-20260915-02']);
    assert.deepEqual(unblocked.perStitch.sc['rounds-tube'].samples, ['GS-20260915-02']);
  });

  test('a fonal: név, szál, címkéről vett kategória és m/100 g', () => {
    const { unblocked } = exampleProfiles();
    assert.equal(unblocked.yarn.name, 'Példa Pamut 125');
    assert.deepEqual(unblocked.yarn.fibre, [{ material: 'pamut', percent: 100 }]);
    assert.deepEqual(unblocked.yarn.cycWeight, { value: 3, source: 'label' });
    assert.deepEqual(unblocked.yarn.metersPer100g, { value: 250, source: 'label' });
  });

  test('ha a címkén nincs kategória, a méterből becsüli, és ezt jelöli', () => {
    const [profile] = buildGaugeProfiles(samplesFrom(edited(TUBE_EXAMPLE, (file) => delete file.yarn.cycWeight)));
    assert.deepEqual(profile.yarn.cycWeight, { value: 3, source: 'estimated' });
  });

  test('a blokkolt profil tudja, mennyit változott a blokkolástól', () => {
    const { unblocked, blocked } = exampleProfiles();
    assert.equal(unblocked.perStitch.sc.rows.blockingChange, null);
    const change = blocked.perStitch.sc.rows.blockingChange;
    near(change.width, (5.7 - 5.65) / 5.65);
    near(change.height, (4.45 - 4.55) / 4.55);
    near(blocked.perStitch.sc.rows.massPerAreaGPerCm2, 8.6 / 144.9);
  });

  test('az azonos kulcsú minták leolvasásai összeadódnak, az n a leolvasások száma', () => {
    const second = edited(TUBE_EXAMPLE, (file) => {
      file.id = 'GS-20260916-01';
      file.measurements[0].grid.widthMm = [60, 60, 60];
    });
    const [profile] = buildGaugeProfiles(samplesFrom(exampleText(TUBE_EXAMPLE), second));
    const tube = profile.perStitch.sc['rounds-tube'];
    assert.equal(tube.widthMm.n, 6);
    near(tube.widthMm.mean, (5.5 * 3 + 6 * 3) / 6);
    assert.deepEqual(stat([5.55, 5.5, 5.45, 6, 6, 6]), tube.widthMm);
    near(tube.massPerAreaGPerCm2, 9.5 / 134.4);
  });

  test('a beszúrás a kulcs része, ha nem a két szál', () => {
    assert.equal(stitchKey('sc', 'both-loops'), 'sc');
    const [profile] = buildGaugeProfiles(samplesFrom(edited(TUBE_EXAMPLE, (file) => (file.stitch.insertion = 'back-loop'))));
    assert.deepEqual(Object.keys(profile.perStitch), ['sc/back-loop']);
  });

  test('a profil sima JSON: mentés és visszaolvasás után ugyanaz', () => {
    const { profiles } = exampleProfiles();
    assert.deepEqual(JSON.parse(JSON.stringify(profiles)), profiles);
  });
});
