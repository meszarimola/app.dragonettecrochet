// KB: interface.md §83

export const MAX_ANGLE = 359;

/** What a numbers-only field keeps of what was typed or pasted: the digits, nothing else. */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

/** A capped field's value: digits only, and anything above `max` becomes `max`. */
export function cappedText(text: string, max: number): string {
  const digits = digitsOnly(text);
  return digits !== '' && Number(digits) > max ? String(max) : digits;
}

/** An angle field's value: digits only, and anything above 359 becomes 359. */
export function angleText(text: string): string {
  return cappedText(text, MAX_ANGLE);
}

/** The whole degree at a point seen from the dial's centre: 0 at the top, growing clockwise. */
export function angleAt(dx: number, dy: number): number {
  const degrees = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
  return wrapAngle(degrees);
}

export function wrapAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** The dial's arc from the top clockwise to `degrees`, on a circle of `r` around (50, 50). */
export function arcPath(degrees: number, r: number): string {
  if (degrees <= 0) return '';
  const radians = (Math.min(degrees, MAX_ANGLE + 0.99) * Math.PI) / 180;
  const x = 50 + r * Math.sin(radians);
  const y = 50 - r * Math.cos(radians);
  return `M 50 ${50 - r} A ${r} ${r} 0 ${degrees > 180 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

/** Rewrites the field to `text` only when it differs, so the caret does not jump while typing digits. */
function rewrite(input: HTMLInputElement, text: string): void {
  if (input.value !== text) input.value = text;
}

/**
 * A slider and the field beside it. The slider moves the field; the field may
 * hold more than the slider's maximum, and the slider then stays at it — unless
 * `capped`, when a larger number becomes the maximum as it is typed. An emptied
 * field gets its last value back when it is left.
 */
export function bindPair(
  range: HTMLInputElement,
  field: HTMLInputElement,
  changed: (value: number) => void,
  capped = false,
): { readonly value: number } {
  const min = Number(range.min);
  const max = Number(range.max);
  let current = Number(field.value);
  const take = (value: number): void => {
    current = Math.max(value, min);
    range.value = String(current);
    changed(current);
  };
  range.addEventListener('input', () => {
    rewrite(field, range.value);
    take(Number(range.value));
  });
  field.addEventListener('input', () => {
    rewrite(field, capped ? cappedText(field.value, max) : digitsOnly(field.value));
    if (field.value !== '') take(Number(field.value));
  });
  field.addEventListener('change', () => rewrite(field, String(current)));
  return {
    get value() {
      return current;
    },
  };
}

const DIAL_R = 42;
const KEY_STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 15,
  PageDown: -15,
};

/**
 * A dial for 0–359°: drag anywhere on the ring, or turn the handle with the
 * arrow keys, and it wraps round past the top. The field in its middle shows
 * the value and takes a typed one.
 */
export class AngleDial {
  private current: number;
  private readonly root: HTMLElement;
  private readonly handle: HTMLElement;
  private readonly field: HTMLInputElement;
  private readonly arc: SVGPathElement;
  private readonly changed: (degrees: number) => void;

  constructor(
    root: HTMLElement,
    handle: HTMLElement,
    field: HTMLInputElement,
    arc: SVGPathElement,
    changed: (degrees: number) => void,
  ) {
    this.root = root;
    this.handle = handle;
    this.field = field;
    this.arc = arc;
    this.changed = changed;
    this.current = Number(angleText(field.value));
    this.render();
    root.addEventListener('pointerdown', (event) => {
      if (event.target === field || event.button !== 0) return;
      event.preventDefault();
      root.setPointerCapture?.(event.pointerId);
      this.handle.focus();
      this.turnTo(event);
    });
    root.addEventListener('pointermove', (event) => {
      if (root.hasPointerCapture?.(event.pointerId)) this.turnTo(event);
    });
    handle.addEventListener('keydown', (event) => {
      const step = KEY_STEP[event.key];
      const next =
        step !== undefined
          ? wrapAngle(this.current + step)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? MAX_ANGLE
              : null;
      if (next === null) return;
      event.preventDefault();
      this.take(next);
    });
    field.addEventListener('input', () => {
      rewrite(field, angleText(field.value));
      if (field.value !== '') this.take(Number(field.value));
    });
    field.addEventListener('change', () => rewrite(field, String(this.current)));
  }

  get value(): number {
    return this.current;
  }

  private turnTo(event: PointerEvent): void {
    const box = this.root.getBoundingClientRect();
    this.take(angleAt(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2));
  }

  private take(degrees: number): void {
    if (degrees === this.current && this.field.value !== '') return;
    this.current = degrees;
    if (document.activeElement !== this.field) rewrite(this.field, String(degrees));
    this.render();
    this.changed(degrees);
  }

  private render(): void {
    this.root.style.setProperty('--angle', `${this.current}deg`);
    this.handle.setAttribute('aria-valuenow', String(this.current));
    this.arc.setAttribute('d', arcPath(this.current, DIAL_R));
  }
}
