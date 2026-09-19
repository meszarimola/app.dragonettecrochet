// KB: core-domain §2

export type CoreValue = string | number | boolean | readonly string[] | readonly number[];

export type CoreData = Readonly<Record<string, CoreValue>>;

export interface CoreText<Code extends string = string> {
  readonly code: Code;
  readonly data?: CoreData;
}

export function text<Code extends string>(code: Code, data?: CoreData): CoreText<Code> {
  return data === undefined ? { code } : { code, data };
}

export function nested(code: string, inner: CoreText): CoreText {
  return { code, data: { inner: inner.code, ...(inner.data ?? {}) } };
}
