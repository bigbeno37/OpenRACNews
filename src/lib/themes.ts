// Each project's look. The card colours and typefaces are openrac.dev's (src/lib/projects.ts), and the
// page accents are the launcher's (launcher/src/lib/palettes.json), which re-colours its whole bar for
// the game that's picked. As in the launcher, Ratchet & Clank keeps the default gold. Neither source has
// anything for the mods, so those take a violet from the site's ink. RaC4's brand is a shade lighter than
// the launcher's #e23c3c, which falls just short of readable as small text on this site's darker page.

export interface Accent {
  amber: string;
  gold: string;
  brand: string;
  stripe: string;
  stripeAlt: string;
  ink: string;
  inkDeep: string;
}

export interface Theme {
  /** The project's name in the navbar and on tags. */
  tag: string;
  font: string;
  border: string;
  text: string;
  text2: string;
  from: string;
  to: string;
  accent?: Accent;
  /** Takes the full width of the home page's grid, where the four games sit in pairs. */
  wide?: boolean;
}

const GOLD_CARD = { border: '#d6a020', text: '#f5c040', text2: '#f5c040', from: '#5a4210', to: '#1c1608' };

const THEMES: Record<string, Theme> = {
  OpenRAC: { tag: 'OpenRAC', font: 'font-orbitron font-semibold', wide: true, ...GOLD_CARD },
  'rac1-decomp': { tag: 'RaC1', font: 'font-audiowide', border: '#747669', text: '#c8d2ff', text2: '#9ca1d4', from: '#3c7a3a', to: '#12331f' },
  'rac2-decomp': {
    tag: 'RaC2',
    font: 'font-orbitron font-semibold',
    border: '#5a7fa6',
    text: '#9fd3ff',
    text2: '#6fa8d6',
    from: '#7a4d1a',
    to: '#2a1a0c',
    accent: { amber: '#7fcff5', gold: '#c4e8fb', brand: '#43a3de', stripe: '#7ec5ea', stripeAlt: '#5ca3ce', ink: '#06233a', inkDeep: '#03141f' },
  },
  'rac3-decomp': {
    tag: 'RaC3',
    font: 'font-orbitron font-semibold',
    border: '#a0742e',
    text: '#ebbe67',
    text2: '#c99a45',
    from: '#25514f',
    to: '#0d1f24',
    accent: { amber: '#ffd23f', gold: '#ffe9a3', brand: '#e9b30c', stripe: '#efcc4d', stripeAlt: '#d7ac27', ink: '#2a2000', inkDeep: '#1c1500' },
  },
  'rac4-decomp': {
    tag: 'RaC4',
    font: 'font-orbitron font-bold',
    border: '#8a2a2a',
    text: '#e9e2e2',
    text2: '#d07070',
    from: '#4a1616',
    to: '#100f13',
    accent: { amber: '#ff6b61', gold: '#ffb8b2', brand: '#e43f3f', stripe: '#e45b5b', stripeAlt: '#d15757', ink: '#2a0606', inkDeep: '#1f0303' },
  },
  'openrac-mods': {
    tag: 'Mods',
    font: 'font-orbitron font-semibold',
    wide: true,
    border: '#7a63b8',
    text: '#d4c2ff',
    text2: '#b39cf0',
    from: '#3b2a66',
    to: '#15102a',
    accent: { amber: '#c4a7ff', gold: '#e3d6ff', brand: '#9b82dc', stripe: '#a58ae0', stripeAlt: '#8f74cc', ink: '#150a33', inkDeep: '#0c0520' },
  },
};

/** A repo added to config/tracking.json works straight away, in gold under its own name. */
export const themeFor = (repo: string): Theme => THEMES[repo] ?? { tag: repo, font: 'font-orbitron font-semibold', wide: true, ...GOLD_CARD };

const accentProperties = ({ amber, gold, brand }: Accent) => `--color-amber: ${amber}; --color-gold: ${gold}; --color-brand: ${brand}; --btn-to: ${brand};`;

/** Re-colours a whole page for a project, bar included. Undefined means the default gold. */
export function pageStyle(repo?: string): string | undefined {
  const accent = repo ? THEMES[repo]?.accent : undefined;
  if (!accent) return undefined;
  return `${accentProperties(accent)} --bar-stripe: ${accent.stripe}; --bar-stripe-alt: ${accent.stripeAlt}; --bar-ink: ${accent.ink}; --bar-ink-deep: ${accent.inkDeep};`;
}

const chroma = (hex: string) => {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...channels) - Math.min(...channels);
};

/** The colour for bars and big numbers, by openrac.dev's rule: a near-white name colour would say nothing, so it uses the second. */
const barColour = ({ text, text2 }: Theme) => (chroma(text) < 40 ? text2 : text);

/** A card in its project's colours, whatever page it's on. */
export function cardStyle(repo: string): string {
  const theme = themeFor(repo);
  const accent = theme.accent ? accentProperties(theme.accent) : '';
  return `--tx: ${barColour(theme)}; background-image: linear-gradient(120deg, ${theme.from}, ${theme.to}); ${accent}`;
}

/** Only the colour that bars and numbers are drawn in, for one outside a card. */
export const barStyle = (repo: string) => `--tx: ${barColour(themeFor(repo))};`;

/** A project's tag in its own card colours, so the rows match the cards. */
export function tagStyle(repo: string): string {
  const t = themeFor(repo);
  return `color: ${t.text2}; border-color: color-mix(in srgb, ${t.border} 55%, transparent); background: color-mix(in srgb, ${t.from} 45%, transparent);`;
}
