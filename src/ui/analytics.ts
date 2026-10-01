import { cookieNamesStartingWith, expireCookie, readConsent } from './consent.js';
import { isMeasuredHost } from './measurement.js';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GTAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js';
const GA_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 395;

type MeasurementDisableFlags = Record<`ga-disable-${string}`, boolean>;
type EventParameters = Record<string, string | number>;

function setMeasurementDisabled(measurementId: string, disabled: boolean): void {
  (window as unknown as MeasurementDisableFlags)[`ga-disable-${measurementId}`] = disabled;
}

export function isMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]{4,}$/.test(id);
}

export function enableAnalytics(measurementId: string): void {
  if (!isMeasurementId(measurementId)) return;
  // KB: decisions.md §9
  if (!isMeasuredHost(location.hostname)) return;

  setMeasurementDisabled(measurementId, false);

  if (window.gtag) {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }

  const dataLayer = (window.dataLayer ??= []);
  window.gtag = function gtag() {
    // gtag.js reads the `arguments` object itself; an array built from it is dropped silently.
    dataLayer.push(arguments);
  };

  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    content_language: contentLanguage(),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: GA_COOKIE_MAX_AGE_SECONDS,
  });

  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `${GTAG_SCRIPT_URL}?id=${encodeURIComponent(measurementId)}`;
  document.head.append(gtagScript);
}

export function disableAnalytics(measurementId: string): void {
  setMeasurementDisabled(measurementId, true);
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' });

  for (const name of ['_ga', '_gid', ...cookieNamesStartingWith('_ga_')]) {
    expireCookie(name);
  }
}

// KB: decisions.md §9 — a refusal within the session must not leave the events
// to `ga-disable`, which is Google's promise rather than ours.
function measurementRunning(): boolean {
  return window.gtag !== undefined && readConsent()?.choice === 'granted';
}

// KB: decisions.md §10
function contentLanguage(): string {
  return document.documentElement.lang;
}

export function trackEvent(name: string, parameters: EventParameters = {}): void {
  if (!measurementRunning()) return;
  window.gtag?.('event', name, { ...parameters, content_language: contentLanguage() });
}

let patternStartReported = false;

// KB: decisions.md §9 — the flag only flips once a measurement is actually running,
// so a decision taken mid-session does not lose the event.
export function trackPatternStart(patternType: string): void {
  if (patternStartReported || !measurementRunning()) return;
  patternStartReported = true;
  trackEvent('pattern_start', { pattern_type: patternType });
}
