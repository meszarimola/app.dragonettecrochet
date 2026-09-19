// KB: interface.md §11

export function applePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function modifierName(platform: string): string {
  return applePlatform(platform) ? '⌥' : 'Alt';
}

export function modifierCombo(key: string, platform: string): string {
  return applePlatform(platform) ? `⌥${key}` : `Alt+${key}`;
}

export function currentPlatform(): string {
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return data?.platform ?? navigator.platform ?? '';
}
