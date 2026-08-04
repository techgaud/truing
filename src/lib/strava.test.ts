import { describe, it, expect } from 'vitest';
import { isCyclingActivity } from './strava';

describe('isCyclingActivity', () => {
	it('accepts every cycling activity type', () => {
		for (const type of ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide']) {
			expect(isCyclingActivity(type)).toBe(true);
		}
	});

	it('rejects runs, hikes, walks, and other non-cycling activities', () => {
		for (const type of ['Run', 'TrailRun', 'Hike', 'Walk', 'Swim', 'Workout', 'AlpineSki']) {
			expect(isCyclingActivity(type)).toBe(false);
		}
	});
});
