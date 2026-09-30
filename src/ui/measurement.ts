// KB: decisions.md §9
const MEASURED_HOSTNAME = 'app.dragonettecrochet.com';

const EXPORT_FORMATS: Record<string, string> = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'application/json': 'json',
};

export function isMeasuredHost(hostname: string): boolean {
  return hostname === MEASURED_HOSTNAME;
}

export function chartExportFormat(mimeType: string): string | null {
  return EXPORT_FORMATS[mimeType] ?? null;
}
