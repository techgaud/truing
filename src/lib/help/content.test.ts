import { describe, it, expect } from 'vitest';
import { getHelpContent } from './content';

describe('getHelpContent', () => {
	it('returns content for dashboard', () => {
		const help = getHelpContent('/');
		expect(help).not.toBeNull();
		expect(help!.title).toBe('Dashboard');
	});

	it('returns content for bikes list', () => {
		const help = getHelpContent('/bikes');
		expect(help).not.toBeNull();
		expect(help!.title).toBe('Bikes');
	});

	it('returns content for rides list', () => {
		const help = getHelpContent('/rides');
		expect(help).not.toBeNull();
		expect(help!.title).toBe('Rides');
	});

	it('returns content for add bike', () => {
		const help = getHelpContent('/bikes/new');
		expect(help).not.toBeNull();
		expect(help!.title).toBe('Add a Bike');
	});

	it('returns content for add ride', () => {
		const help = getHelpContent('/rides/new');
		expect(help).not.toBeNull();
		expect(help!.title).toBe('Add a Ride');
	});

	it('returns content for more page', () => {
		const help = getHelpContent('/more');
		expect(help).not.toBeNull();
		expect(help!.title).toBe('More');
	});

	it('returns content for parts bin', () => {
		const help = getHelpContent('/parts-bin');
		expect(help).not.toBeNull();
		expect(help!.title).toBe('Parts Bin');
	});

	it('matches dynamic bike detail route', () => {
		const help = getHelpContent('/bikes/42');
		expect(help).not.toBeNull();
		expect(help!.title).toBe('Bike Detail');
	});

	it('matches multi-digit bike ids', () => {
		const help = getHelpContent('/bikes/123');
		expect(help).not.toBeNull();
		expect(help!.title).toBe('Bike Detail');
	});

	it('returns null for unknown routes', () => {
		expect(getHelpContent('/unknown')).toBeNull();
	});

	it('returns null for partial matches', () => {
		expect(getHelpContent('/bikes/42/edit')).toBeNull();
	});

	it('all help content has non-empty fields', () => {
		const routes = ['/', '/bikes', '/bikes/new', '/rides', '/rides/new', '/more', '/parts-bin'];
		for (const route of routes) {
			const help = getHelpContent(route);
			expect(help!.title.length).toBeGreaterThan(0);
			expect(help!.description.length).toBeGreaterThan(0);
			expect(help!.actions.length).toBeGreaterThan(0);
		}
	});
});
