import { useState, useEffect } from 'react';
import { MasteryBand } from './types';

export interface GraphTheme {
  bg: string;
  surface: string;
  border: string;
  ink: string;
  muted: string;
  accent: string;
  accentTint: string;
  masteryStrongFill: string;
  masteryStrongInk: string;
  masteryMidFill: string;
  masteryMidInk: string;
  masteryWeakFill: string;
  masteryWeakInk: string;
  masteryNone: string;
  link: string;
  halo: string;
}

export const FALLBACK_GRAPH_THEME: GraphTheme = {
  bg: '#FAF7F2',
  surface: '#FDFBF7',
  border: '#E8E2D8',
  ink: '#1C1917',
  muted: '#6B645B',
  accent: '#C2502A',
  accentTint: '#F6E3D8',
  masteryStrongFill: '#3F8F63',
  masteryStrongInk: '#2F6F4B',
  masteryMidFill: '#BF7A0A',
  masteryMidInk: '#8A5606',
  masteryWeakFill: '#B8322A',
  masteryWeakInk: '#8F231D',
  masteryNone: '#A8A197',
  link: 'rgba(28, 25, 23, 0.14)',
  halo: '#FAF7F2',
};

/**
 * Reads theme tokens from document.documentElement styles as plain strings.
 * Used by canvas rendering and components to prevent any theme drift.
 */
export function getGraphTheme(): GraphTheme {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return FALLBACK_GRAPH_THEME;
  }

  const styles = getComputedStyle(document.documentElement);
  const getVar = (name: string, fallback: string): string => {
    const val = styles.getPropertyValue(name).trim();
    return val || fallback;
  };

  const bg = getVar('--bg', FALLBACK_GRAPH_THEME.bg);

  return {
    bg,
    surface: getVar('--surface', FALLBACK_GRAPH_THEME.surface),
    border: getVar('--border', FALLBACK_GRAPH_THEME.border),
    ink: getVar('--ink', FALLBACK_GRAPH_THEME.ink),
    muted: getVar('--muted', FALLBACK_GRAPH_THEME.muted),
    accent: getVar('--accent', FALLBACK_GRAPH_THEME.accent),
    accentTint: getVar('--accent-tint', FALLBACK_GRAPH_THEME.accentTint),
    masteryStrongFill: getVar('--mastery-strong-fill', FALLBACK_GRAPH_THEME.masteryStrongFill),
    masteryStrongInk: getVar('--mastery-strong-ink', FALLBACK_GRAPH_THEME.masteryStrongInk),
    masteryMidFill: getVar('--mastery-mid-fill', FALLBACK_GRAPH_THEME.masteryMidFill),
    masteryMidInk: getVar('--mastery-mid-ink', FALLBACK_GRAPH_THEME.masteryMidInk),
    masteryWeakFill: getVar('--mastery-weak-fill', FALLBACK_GRAPH_THEME.masteryWeakFill),
    masteryWeakInk: getVar('--mastery-weak-ink', FALLBACK_GRAPH_THEME.masteryWeakInk),
    masteryNone: getVar('--mastery-none', FALLBACK_GRAPH_THEME.masteryNone),
    link: getVar('--link', FALLBACK_GRAPH_THEME.link),
    halo: getVar('--halo', bg || FALLBACK_GRAPH_THEME.halo),
  };
}

/**
 * React hook to access graph theme tokens and re-read on theme changes or mount.
 */
export function useGraphTheme(): GraphTheme {
  const [theme, setTheme] = useState<GraphTheme>(() => getGraphTheme());

  useEffect(() => {
    // Initial read in client
    setTheme(getGraphTheme());

    // Watch for class/attribute changes on <html> in case of dark/light toggles
    const observer = new MutationObserver(() => {
      setTheme(getGraphTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}

/**
 * Maps mastery band to its fill token
 */
export function getBandFillColor(band: MasteryBand, theme: GraphTheme): string {
  switch (band) {
    case 'strong':
      return theme.masteryStrongFill;
    case 'developing':
      return theme.masteryMidFill;
    case 'weak':
      return theme.masteryWeakFill;
    default:
      return theme.masteryNone;
  }
}

/**
 * Maps mastery band to its ink text token for AA contrast
 */
export function getBandInkColor(band: MasteryBand, theme: GraphTheme): string {
  switch (band) {
    case 'strong':
      return theme.masteryStrongInk;
    case 'developing':
      return theme.masteryMidInk;
    case 'weak':
      return theme.masteryWeakInk;
    default:
      return theme.muted;
  }
}
