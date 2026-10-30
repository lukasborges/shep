export type TabFit = 'named' | 'icon' | 'hidden';

export interface FittingTab {
	named: number;
	icon: number;
	selected: boolean;
	hideable: boolean;
}

export function fitTabs(tabs: readonly FittingTab[], room: number, overflow: number): TabFit[] {
	const fits: TabFit[] = tabs.map(() => 'named');
	const used = () => tabs.reduce((sum, tab, index) => sum + (fits[index] === 'named' ? tab.named : fits[index] === 'icon' ? tab.icon : 0), 0)
		+ (fits.includes('hidden') ? overflow : 0);
	for ( let index = tabs.length - 1; index >= 0 && used() > room; index-- ) if ( !tabs[index]?.selected ) fits[index] = 'icon';
	for ( let index = tabs.length - 1; index >= 0 && used() > room; index-- ) {
		if ( !tabs[index]?.selected && tabs[index]?.hideable ) fits[index] = 'hidden';
	}
	return fits;
}
