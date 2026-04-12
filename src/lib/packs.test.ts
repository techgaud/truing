import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { validatePack, findNewCustomTypes, applyPack, exportBikeAsPack } from './packs';
import { loadCustomTypes } from './intervals';

beforeEach(async () => {
	await db.bikes.clear();
	await db.components.clear();
	await db.installations.clear();
	await db.custom_component_types.clear();
	await loadCustomTypes();
});

const validPack = {
	format: 'truing-pack',
	version: 1,
	name: 'Test Bike',
	description: null,
	bike: null,
	components: [
		{
			type: 'chain_11sp',
			name: 'Shimano CN-HG601',
			category: 'drivetrain',
			distance_meters: 4800000,
			time_days: null,
			inspection_distance_meters: null,
			inspection_time_days: null,
			notes: null
		}
	]
};

describe('validatePack', () => {
	it('accepts a valid pack', () => {
		const pack = validatePack(validPack);
		expect(pack.name).toBe('Test Bike');
		expect(pack.components).toHaveLength(1);
	});

	it('rejects wrong format', () => {
		expect(() => validatePack({ ...validPack, format: 'wrong' })).toThrow('Not a Truing data pack');
	});

	it('rejects missing name', () => {
		expect(() => validatePack({ ...validPack, name: '' })).toThrow('missing a name');
	});

	it('rejects empty components', () => {
		expect(() => validatePack({ ...validPack, components: [] })).toThrow('no components');
	});

	it('rejects missing components', () => {
		expect(() =>
			validatePack({ format: 'truing-pack', version: 1, name: 'Test', description: null })
		).toThrow('no components');
	});
});

describe('findNewCustomTypes', () => {
	it('returns empty for known shipped types', () => {
		const pack = validatePack(validPack);
		const newTypes = findNewCustomTypes(pack);
		expect(newTypes).toHaveLength(0);
	});

	it('returns unknown types', () => {
		const pack = validatePack({
			...validPack,
			components: [{ ...validPack.components[0], type: 'custom_widget_xyz' }]
		});
		const newTypes = findNewCustomTypes(pack);
		expect(newTypes).toHaveLength(1);
		expect(newTypes[0].type).toBe('custom_widget_xyz');
	});
});

describe('applyPack', () => {
	it('creates components and installations', async () => {
		const bikeId = (await db.bikes.add({
			name: 'Test',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		const result = await applyPack(bikeId, validPack.components, [], '2026-01-01');
		expect(result.added).toBe(1);

		const components = await db.components.toArray();
		expect(components).toHaveLength(1);
		expect(components[0].name).toBe('Shimano CN-HG601');

		const installations = await db.installations.toArray();
		expect(installations).toHaveLength(1);
		expect(installations[0].bike_id).toBe(bikeId);
	});

	it('skips duplicate component types on same bike', async () => {
		const bikeId = (await db.bikes.add({
			name: 'Test',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		await applyPack(bikeId, validPack.components, []);
		const result = await applyPack(bikeId, validPack.components, []);
		expect(result.added).toBe(0);

		expect(await db.components.count()).toBe(1);
	});

	it('creates custom types when provided', async () => {
		const bikeId = (await db.bikes.add({
			name: 'Test',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		const customComp = {
			type: 'my_custom_part',
			name: 'Custom Part',
			category: 'custom',
			distance_meters: 10000,
			time_days: null,
			inspection_distance_meters: null,
			inspection_time_days: null,
			notes: null
		};

		await applyPack(bikeId, [customComp], [customComp]);
		const ct = await db.custom_component_types.get('my_custom_part');
		expect(ct).toBeDefined();
		expect(ct!.label).toBe('Custom Part');
	});
});

describe('exportBikeAsPack', () => {
	it('produces valid pack JSON', () => {
		const json = exportBikeAsPack('Topstone 2', { make: 'Cannondale', year: 2025 }, [
			{
				type: 'chain_11sp',
				name: 'Chain',
				category: 'drivetrain',
				distance_meters: 4800000,
				time_days: null,
				inspection_distance_meters: null,
				inspection_time_days: null,
				notes: null
			}
		]);
		const parsed = JSON.parse(json);
		expect(parsed.format).toBe('truing-pack');
		expect(parsed.name).toBe('Topstone 2');
		expect(parsed.components).toHaveLength(1);
		expect(parsed.bike.make).toBe('Cannondale');
	});

	it('handles missing bike info gracefully', () => {
		const json = exportBikeAsPack('Bare Bike', {}, [
			{
				type: 'tire_front',
				name: 'Tire',
				category: 'wheels_tires',
				distance_meters: null,
				time_days: null,
				inspection_distance_meters: null,
				inspection_time_days: null,
				notes: null
			}
		]);
		const parsed = JSON.parse(json);
		expect(parsed.description).toBeNull();
		expect(parsed.bike.make).toBeNull();
	});
});
