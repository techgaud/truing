export type HelpContent = {
	title: string;
	description: string;
	actions: string[];
};

const staticRoutes: Record<string, HelpContent> = {
	'/': {
		title: 'Dashboard',
		description: 'At a glance, what needs attention across your bikes.',
		actions: [
			'Overdue and due soon items are grouped at the top, most urgent first.',
			'Expand "healthy components" at the bottom to see the full list.'
		]
	},
	'/bikes': {
		title: 'Bikes',
		description: 'Every bike you have added.',
		actions: [
			'Tap a bike to see its components and available actions.',
			'Tap "Add a bike" to create a new one.'
		]
	},
	'/bikes/new': {
		title: 'Add a bike',
		description: 'Name and type are required. Everything else is optional.',
		actions: [
			'Expand "More details" to fill in make, model, year, purchase info, and a starting odometer value.',
			'Submit to land back on the dashboard.'
		]
	},
	'/rides': {
		title: 'Rides',
		description: 'Every ride you have logged, newest first.',
		actions: [
			'Swipe left on a row to reveal a red delete button.',
			'Tab to a row and press Delete for a keyboard shortcut.',
			'After deleting you have 5 seconds to undo via the toast at the bottom.',
			'Tap "Add a ride" to log one manually.'
		]
	},
	'/rides/new': {
		title: 'Add a ride',
		description: 'Bike, distance, and date are required.',
		actions: [
			'Expand "More details" to record duration, elevation gain, and notes.',
			'Submit to land back on the rides list.'
		]
	}
};

const dynamicRoutes: Array<[RegExp, HelpContent]> = [
	[
		/^\/bikes\/\d+$/,
		{
			title: 'Bike detail',
			description: 'One bike, its components, and the actions you can take.',
			actions: [
				'If the bike has no components yet, tap "Load typical list" to bulk add a template of common parts.',
				'"Add one component" opens a form for a single entry.',
				'Each component row has inline Edit and Delete buttons.',
				'"Archive this bike" hides it from the dashboard while keeping its history.'
			]
		}
	]
];

export function getHelpContent(pathname: string): HelpContent | null {
	const direct = staticRoutes[pathname];
	if (direct) return direct;
	for (const [pattern, content] of dynamicRoutes) {
		if (pattern.test(pathname)) return content;
	}
	return null;
}
