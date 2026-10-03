// KB: interface.md §11

export function applePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function modifierCombo(key: string, platform: string): string {
  return applePlatform(platform) ? `⌥${key}` : `Alt+${key}`;
}

export function currentPlatform(): string {
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return data?.platform ?? navigator.platform ?? '';
}

/**
 * By the letter where the layout gives one, unlike the other commands: Z and Y
 * swap places on a Hungarian keyboard, and Ctrl/⌘ + Z must undo under the key
 * marked Z. KB: interface.md §11
 */
export function historyCommand(event: {
  readonly key: string;
  readonly code: string;
  readonly shiftKey: boolean;
}): 'undo' | 'redo' | null {
  const key = event.key.toLowerCase();
  const letter = /^[a-z]$/.test(key) ? key : /^Key([A-Z])$/.exec(event.code)?.[1]?.toLowerCase();
  if (letter === 'z') return event.shiftKey ? 'redo' : 'undo';
  return letter === 'y' && !event.shiftKey ? 'redo' : null;
}
