import { disableAnalytics, enableAnalytics } from './analytics.js';
import { type ConsentChoice, readConsent, writeConsent } from './consent.js';

export function setupConsentBanner(measurementId: string): void {
  const banner = document.querySelector<HTMLElement>('#consent');
  if (!banner || !measurementId) return;

  const applyChoice = (choice: ConsentChoice): void =>
    choice === 'granted' ? enableAnalytics(measurementId) : disableAnalytics(measurementId);

  const showCurrentChoice = (choice: ConsentChoice | undefined): void => {
    for (const line of banner.querySelectorAll<HTMLElement>('[data-consent-current]')) {
      line.hidden = line.dataset.consentCurrent !== choice;
    }
  };

  const moveFocusToFirstHeaderControl = (): void =>
    document.querySelector<HTMLElement>('.bar a, .bar button')?.focus({ preventScroll: true });

  const savedConsent = readConsent();
  if (savedConsent) {
    applyChoice(savedConsent.choice);
  } else {
    banner.hidden = false;
  }

  banner.addEventListener('click', (event) => {
    const choiceButton = (event.target as Element).closest<HTMLElement>('[data-consent]');
    if (!choiceButton) return;

    const choice = choiceButton.dataset.consent as ConsentChoice;
    writeConsent(choice);
    applyChoice(choice);
    banner.hidden = true;
    moveFocusToFirstHeaderControl();
  });

  for (const settingsButton of document.querySelectorAll<HTMLButtonElement>('[data-consent-open]')) {
    settingsButton.hidden = false;
    settingsButton.addEventListener('click', () => {
      showCurrentChoice(readConsent()?.choice);
      banner.hidden = false;
      banner.focus();
    });
  }
}
