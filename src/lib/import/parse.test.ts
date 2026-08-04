import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseFile } from './parse';

// fit-file-parser returns a JS Date for session.start_time at RUNTIME, even
// though its bundled .d.ts declares start_time as a string (see
// node_modules/fit-file-parser/dist/binary.js and fit_types.d.ts:334). This
// mock reproduces that actual runtime shape (a Date) so the toIsoString
// boundary guard in parse.ts is exercised against the real lie, not the
// declared-but-false string type. GPX tests below do not touch this module.
vi.mock('fit-file-parser', () => ({
	default: class {
		parseAsync() {
			return Promise.resolve({
				activity: {
					sessions: [
						{
							total_distance: 42195.5,
							start_time: new Date('2026-07-30T13:45:00.000Z'),
							total_elapsed_time: 3600,
							total_ascent: 120
						}
					]
				}
			});
		}
	}
}));

function makeFile(name: string, content: string): File {
	return {
		name,
		text: () => Promise.resolve(content),
		arrayBuffer: () => Promise.resolve(new TextEncoder().encode(content).buffer as ArrayBuffer)
	} as unknown as File;
}

describe('parseFile', () => {
	it('rejects unsupported file types', async () => {
		expect(await parseFile(makeFile('data.csv', 'a,b,c')).catch((e) => e.message)).toMatch(
			/Unsupported/
		);
	});

	it('parses a GPX file with distance and time', async () => {
		const gpxContent = readFileSync(
			resolve(__dirname, '../../../test/fixtures/sample.gpx'),
			'utf-8'
		);
		const file = makeFile('ride.gpx', gpxContent);
		const result = await parseFile(file);

		expect(result.source).toBe('gpx');
		expect(result.distance_meters).toBeGreaterThan(0);
		expect(result.started_at).toContain('2026-03-15');
		expect(result.duration_seconds).toBeGreaterThan(0);
		expect(result.external_id).toHaveLength(64);
	});

	it('produces consistent hash for identical content', async () => {
		const gpxContent = readFileSync(
			resolve(__dirname, '../../../test/fixtures/sample.gpx'),
			'utf-8'
		);
		const file1 = makeFile('a.gpx', gpxContent);
		const file2 = makeFile('b.gpx', gpxContent);
		const r1 = await parseFile(file1);
		const r2 = await parseFile(file2);
		expect(r1.external_id).toBe(r2.external_id);
	});

	it('normalizes a FIT Date start_time into an ISO string', async () => {
		const file = makeFile('ride.fit', 'binary-fit-bytes');
		const result = await parseFile(file);

		expect(result.source).toBe('fit');
		// The critical assertion: a string, never a Date, reaches the app.
		expect(typeof result.started_at).toBe('string');
		expect(result.started_at).toBe('2026-07-30T13:45:00.000Z');
		expect(result.distance_meters).toBe(42196);
		expect(result.duration_seconds).toBe(3600);
		expect(result.elevation_gain_meters).toBe(120);
	});
});
