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
			'Tap "Add a bike" to create a new one.',
			'Expand "Parts bin" at the bottom to see uninstalled components.'
		]
	},
	'/bikes/new': {
		title: 'Add a Bike',
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
		title: 'Add a Ride',
		description: 'Bike, distance, and date are required.',
		actions: [
			'Expand "More details" to record duration, elevation gain, and notes.',
			'Submit to land back on the rides list.'
		]
	},
	'/more': {
		title: 'More',
		description: 'Settings, help, and data management.',
		actions: [
			'Press ? on any screen for help specific to that screen.',
			'Settings has unit preferences, keyboard shortcuts, Strava, data packs, backup, and storage info.'
		]
	},
	'/parts-bin': {
		title: 'Parts Bin',
		description: 'Components that are uninstalled but not retired.',
		actions: [
			'Tap "Install" to put a component on a bike.',
			'Tap "Retire" to mark a component as done permanently.',
			'Tap the component name to see its full history.'
		]
	}
};

const dynamicRoutes: Array<[RegExp, HelpContent]> = [
	[
		/^\/bikes\/\d+$/,
		{
			title: 'Bike Detail',
			description: 'One bike, its components, and the actions you can take.',
			actions: [
				'Tap "Load typical list" to bulk add a template of common components.',
				'Tap the + button to add a single component.',
				'Each component row has inline Edit, Uninstall, and Delete actions.',
				'Use the three-dot menu for Export and Archive options.'
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
