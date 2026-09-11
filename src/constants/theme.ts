/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * The palette is semantic, not decorative. Each accent means one thing
 * throughout the app, so feedback can be read at a glance without labels:
 *
 *   success  → the Correct tier, a full criterion band, German that is right
 *   primary  → the Simpler tier, actions, anything navigable
 *   accent   → the More advanced tier, i.e. deliberately above B1
 *   warning  → over time, over length, a partial band
 *   danger   → a Mistake instance, a failing band
 *
 * The *Soft variants are tinted backgrounds for those same meanings. Never use
 * an accent for decoration alone — if it has no meaning here, use a surface.
 */
export const Colors = {
  light: {
    text: '#1C1B1F',
    textSecondary: '#6B6862',
    background: '#FAF9F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F1EFEA',
    border: '#E4E0D9',
    primary: '#2F5FD8',
    primarySoft: '#E9EEFC',
    success: '#1F7A4D',
    successSoft: '#E3F3EA',
    warning: '#A9640C',
    warningSoft: '#FBF0DC',
    danger: '#BB3B2C',
    dangerSoft: '#FBE9E6',
    accent: '#7A3FA8',
    accentSoft: '#F3EAFA',
  },
  dark: {
    text: '#F2F1EE',
    textSecondary: '#A5A29C',
    background: '#131316',
    backgroundElement: '#1C1C21',
    backgroundSelected: '#26262D',
    border: '#33333C',
    primary: '#87A9F7',
    primarySoft: '#1D2740',
    success: '#5FCB92',
    successSoft: '#15281E',
    warning: '#E5B15C',
    warningSoft: '#2C2315',
    danger: '#F0897C',
    dangerSoft: '#2F1B18',
    accent: '#C79BE8',
    accentSoft: '#241A2E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
