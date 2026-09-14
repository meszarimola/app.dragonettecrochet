export const CONSENT_COOKIE = 'dc_consent';
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export const SHARED_COOKIE_DOMAIN = 'dragonettecrochet.com';

export type ConsentChoice = 'granted' | 'denied';

export interface Consent {
  choice: ConsentChoice;
  version: number;
  decidedAtSeconds: number;
}

interface CookieContext {
  hostname: string;
  secure: boolean;
}

export function parseConsent(cookies: string): Consent | null {
  for (const part of cookies.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name !== CONSENT_COOKIE) continue;

    const [version, choice, decidedAt] = valueParts.join('=').split(':');
    if (Number(version) !== CONSENT_VERSION) return null;
    if (choice !== 'granted' && choice !== 'denied') return null;
    if (!/^\d+$/.test(decidedAt ?? '')) return null;

    return { choice, version: CONSENT_VERSION, decidedAtSeconds: Number(decidedAt) };
  }
  return null;
}

export function sharedCookieDomain(hostname: string): string | undefined {
  const isOwnDomain =
    hostname === SHARED_COOKIE_DOMAIN || hostname.endsWith(`.${SHARED_COOKIE_DOMAIN}`);
  return isOwnDomain ? SHARED_COOKIE_DOMAIN : undefined;
}

export function serializeConsent(
  choice: ConsentChoice,
  { hostname, secure, now = Date.now() }: CookieContext & { now?: number },
): string {
  const value = `${CONSENT_VERSION}:${choice}:${Math.floor(now / 1000)}`;
  return cookieLine(CONSENT_COOKIE, value, CONSENT_MAX_AGE_SECONDS, { hostname, secure });
}

export function expireCookieLines(name: string, { hostname, secure }: CookieContext): string[] {
  const hostOnlyLine = cookieLine(name, '', 0, { hostname: '', secure });
  if (!sharedCookieDomain(hostname)) return [hostOnlyLine];
  return [hostOnlyLine, cookieLine(name, '', 0, { hostname, secure })];
}

function cookieLine(
  name: string,
  value: string,
  maxAgeSeconds: number,
  { hostname, secure }: CookieContext,
): string {
  const domain = sharedCookieDomain(hostname);
  return [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    domain && `Domain=${domain}`,
    'SameSite=Lax',
    secure && 'Secure',
  ]
    .filter(Boolean)
    .join('; ');
}

function currentPageCookieContext(): CookieContext {
  return { hostname: location.hostname, secure: location.protocol === 'https:' };
}

export function readConsent(): Consent | null {
  return parseConsent(document.cookie);
}

export function writeConsent(choice: ConsentChoice): void {
  document.cookie = serializeConsent(choice, currentPageCookieContext());
}

export function expireCookie(name: string): void {
  for (const line of expireCookieLines(name, currentPageCookieContext())) {
    document.cookie = line;
  }
}

export function cookieNamesStartingWith(prefix: string): string[] {
  return document.cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter((name) => name.startsWith(prefix));
}
