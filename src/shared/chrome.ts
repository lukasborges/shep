export const TITLE_BAR_HEIGHT = 40;
export const RAIL_WIDTH = 68;
export const PAGE_CORNER_RADIUS = 8;

// The rail and the title bar, which the system's window buttons are painted over,
// so main needs the same values as the stylesheet.
export const CHROME_COLOURS = {
	light: { chrome: '#EEF1F6', onChrome: '#3A4356' },
	dark: { chrome: '#282C35', onChrome: '#D3D8E2' }
} as const;

export type ColourScheme = keyof typeof CHROME_COLOURS;
