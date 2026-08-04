import FitParser from 'fit-file-parser';
import gpxParser from 'gpxparser';

export type ParsedRide = {
	distance_meters: number;
	started_at: string;
	duration_seconds?: number | undefined;
	elevation_gain_meters?: number | undefined;
	source: 'gpx' | 'fit';
	external_id: string;
};

export async function parseFile(file: File): Promise<ParsedRide> {
	const ext = file.name.split('.').pop()?.toLowerCase();
	if (ext === 'gpx') {
		const text = await file.text();
		return parseGPX(text);
	}
	if (ext === 'fit') {
		const buffer = await file.arrayBuffer();
		return parseFIT(buffer);
	}
	throw new Error(`Unsupported file type .${ext}. Use .gpx or .fit files.`);
}

async function parseGPX(text: string): Promise<ParsedRide> {
	const gpx = new gpxParser();
	gpx.parse(text);
	const track = gpx.tracks[0];
	if (!track || track.points.length === 0) throw new Error('No tracks found in GPX file.');

	const firstPoint = track.points[0];
	const lastPoint = track.points[track.points.length - 1];
	if (!firstPoint || !lastPoint) throw new Error('No tracks found in GPX file.');

	const startTime = firstPoint.time;
	const endTime = lastPoint.time;
	const duration =
		startTime && endTime ? (endTime.getTime() - startTime.getTime()) / 1000 : undefined;

	return {
		distance_meters: Math.round(track.distance.total),
		started_at: startTime?.toISOString() ?? new Date().toISOString(),
		duration_seconds: duration != null && duration > 0 ? Math.round(duration) : undefined,
		elevation_gain_meters:
			track.elevation.pos != null && track.elevation.pos > 0
				? Math.round(track.elevation.pos)
				: undefined,
		source: 'gpx',
		external_id: await hashContent(text)
	};
}

async function parseFIT(buffer: ArrayBuffer): Promise<ParsedRide> {
	const parser = new FitParser({
		force: true,
		speedUnit: 'm/s',
		lengthUnit: 'm',
		elapsedRecordField: true,
		mode: 'cascade'
	});

	const data = await parser.parseAsync(buffer);
	const session = data.activity?.sessions?.[0] ?? data.sessions?.[0];
	if (!session) throw new Error('No session data found in FIT file.');

	return {
		distance_meters: Math.round(session.total_distance ?? 0),
		started_at: toIsoString(session.start_time),
		duration_seconds:
			session.total_elapsed_time != null ? Math.round(session.total_elapsed_time) : undefined,
		elevation_gain_meters:
			session.total_ascent != null ? Math.round(session.total_ascent) : undefined,
		source: 'fit',
		external_id: await hashContent(buffer)
	};
}

// Boundary guard. fit-file-parser's own .d.ts declares session.start_time as a
// string, but at runtime the library returns a JS Date object (see
// node_modules/fit-file-parser/dist/binary.js). The rest of the app requires an
// ISO string in started_at, so we normalize here at the parse door and reject
// anything that is neither a Date nor a parseable string. This keeps a future
// parser change from ever storing a Date and silently corrupting wear math.
function toIsoString(value: unknown): string {
	if (value == null) return new Date().toISOString();
	if (value instanceof Date) {
		const ms = value.getTime();
		if (Number.isNaN(ms)) throw new Error('FIT file has an invalid start time.');
		return value.toISOString();
	}
	if (typeof value === 'string') {
		const ms = Date.parse(value);
		if (Number.isNaN(ms)) throw new Error('FIT file has an invalid start time.');
		return new Date(ms).toISOString();
	}
	throw new Error('FIT file has an unrecognized start time.');
}

async function hashContent(content: string | ArrayBuffer): Promise<string> {
	const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : content;
	const hash = await crypto.subtle.digest('SHA-256', buffer);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
