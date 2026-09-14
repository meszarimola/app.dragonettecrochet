import { cookieNamesStartingWith, expireCookie } from './consent.js';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GTAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js';
const GA_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 395;

type MeasurementDisableFlags = Record<`ga-disable-${string}`, boolean>;

function setMeasurementDisabled(measurementId: string, disabled: boolean): void {
  (window as unknown as MeasurementDisableFlags)[`ga-disable-${measurementId}`] = disabled;
}

export function isMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]{4,}$/.test(id);
}

export function enableAnalytics(measurementId: string): void {
  if (!isMeasurementId(measurementId)) return;

  setMeasurementDisabled(measurementId, false);

  if (window.gtag) {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }

  const dataLayer = (window.dataLayer ??= []);
  window.gtag = function gtag() {
    // A gtag.js csak az `arguments` objektumot dolgozza fel, a tömbbé alakítottat némán eldobja.
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
