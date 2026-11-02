// Each project's card colours, typeface and short tag, taken from openrac.dev (src/lib/projects.ts) so
// a project looks the same on both sites. That site has no card for the launcher or the mods, so those
// two take its gold and a violet from its ink.

export interface Theme {
  tag: string;
  font: string;
  border: string;
  text: string;
  text2: string;
  from: string;
  to: string;
}

const FALLBACK: Theme = {
  tag: 'OpenRAC',
  font: 'font-orbitron font-semibold',
  border: '#d6a020',
  text: '#f5c040',
  text2: '#f5c040',
  from: '#5a4210',
  to: '#1c1608',
};

const THEMES: Record<string, Theme> = {
  'rac1-decomp': { tag: 'RaC1', font: 'font-audiowide', border: '#747669', text: '#c8d2ff', text2: '#9ca1d4', from: '#3c7a3a', to: '#12331f' },
  'rac2-decomp': { tag: 'GC', font: 'font-orbitron font-semibold', border: '#5a7fa6', text: '#9fd3ff', text2: '#6fa8d6', from: '#7a4d1a', to: '#2a1a0c' },
  'rac3-decomp': { tag: 'UYA', font: 'font-orbitron font-semibold', border: '#a0742e', text: '#ebbe67', text2: '#c99a45', from: '#25514f', to: '#0d1f24' },
  'rac4-decomp': { tag: 'DL', font: 'font-orbitron font-bold', border: '#8a2a2a', text: '#e9e2e2', text2: '#d07070', from: '#4a1616', to: '#100f13' },
  OpenRAC: { ...FALLBACK, tag: 'Launcher' },
  'openrac-mods': { tag: 'Mods', font: 'font-orbitron font-semibold', border: '#7a63b8', text: '#d4c2ff', text2: '#b39cf0', from: '#3b2a66', to: '#15102a' },
};

export const themeFor = (repo: string): Theme => THEMES[repo] ?? FALLBACK;

/** A project's tag in its own card colours, so the rows match the cards. */
export function tagStyle(repo: string): string {
  const t = themeFor(repo);
  return `color: ${t.text2}; border-color: color-mix(in srgb, ${t.border} 55%, transparent); background: color-mix(in srgb, ${t.from} 45%, transparent);`;
}
