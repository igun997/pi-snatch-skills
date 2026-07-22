export type IconConfidence = 'high' | 'medium' | 'low';

export interface IconCandidate {
  tag: string;
  classTokens: string[];
  attributes: Record<string, string>;
}

export interface DetectedIcon {
  vendor: string;
  iconName: string | null;
  confidence: IconConfidence;
}

const normalizeName = (value: string): string | null => {
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, '-');
  return /^[a-z0-9-]{1,80}$/.test(normalized) ? normalized : null;
};

const className = (tokens: string[], pattern: RegExp): string | null => {
  const match = tokens.map((token) => token.match(pattern)).find(Boolean);
  return match?.[1] ? normalizeName(match[1]) : null;
};

function detectIcon(candidate: IconCandidate): DetectedIcon | null {
  const tag = typeof candidate?.tag === 'string' ? candidate.tag.toLowerCase() : '';
  const tokens = Array.isArray(candidate?.classTokens)
    ? candidate.classTokens.filter((token): token is string => typeof token === 'string').map((token) => token.toLowerCase())
    : [];
  const attributes = candidate?.attributes && typeof candidate.attributes === 'object' && !Array.isArray(candidate.attributes)
    ? candidate.attributes as Record<string, unknown>
    : {};
  const attribute = (name: string) => typeof attributes[name] === 'string' ? attributes[name] : '';
  const dataLucide = normalizeName(attribute('data-lucide'));
  const lucide = dataLucide ?? className(tokens, /^lucide-(.+)$/);
  if (lucide) return { vendor: 'Lucide', iconName: lucide, confidence: 'high' };

  const fontAwesome = className(tokens, /^fa-(?!solid$|regular$|brands$|light$|thin$|duotone$)(.+)$/);
  if (fontAwesome && tokens.some((token) => /^fa-(solid|regular|brands|light|thin|duotone)$/.test(token))) {
    return { vendor: 'Font Awesome', iconName: fontAwesome, confidence: 'high' };
  }

  if (tokens.some((token) => /^material-symbols(?:-|$)/.test(token))) {
    const iconName = normalizeName(attribute('text'));
    if (iconName) return { vendor: 'Material Symbols', iconName, confidence: 'high' };
  }

  if (tokens.includes('material-icons')) {
    const iconName = normalizeName(attribute('text'));
    if (iconName) return { vendor: 'Material Icons', iconName, confidence: 'high' };
  }

  const heroicon = className(tokens, /^heroicon-(?:outline|solid|mini|micro)-(.+)$/);
  if (heroicon) return { vendor: 'Heroicons', iconName: heroicon, confidence: 'high' };

  const bootstrap = className(tokens, /^bi-(.+)$/);
  if (bootstrap && tokens.includes('bi')) return { vendor: 'Bootstrap Icons', iconName: bootstrap, confidence: 'high' };

  const tabler = className(tokens, /^ti-(.+)$/);
  if (tabler && tokens.includes('ti')) return { vendor: 'Tabler Icons', iconName: tabler, confidence: 'high' };

  return tag === 'svg'
    ? { vendor: 'unknown', iconName: null, confidence: 'low' }
    : null;
}

export function detectIconCandidates(candidates: IconCandidate[]): DetectedIcon[] {
  const detections = candidates
    .map(detectIcon)
    .filter((icon): icon is DetectedIcon => icon !== null);
  const deduplicated = new Map<string, DetectedIcon>();
  for (const icon of detections) deduplicated.set(`${icon.vendor}\u0000${icon.iconName ?? ''}`, icon);
  return [...deduplicated.values()].sort((left, right) =>
    left.vendor.localeCompare(right.vendor) || (left.iconName ?? '').localeCompare(right.iconName ?? ''),
  );
}
