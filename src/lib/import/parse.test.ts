import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseFile } from './parse';

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
});
