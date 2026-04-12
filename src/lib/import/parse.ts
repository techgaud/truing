import FitParser from 'fit-file-parser';
import gpxParser from 'gpxparser';

export type ParsedRide = {
	distance_meters: number;
	started_at: string;
	duration_seconds?: number;
	elevation_gain_meters?: number;
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

	const startTime = track.points[0].time;
	const endTime = track.points[track.points.length - 1].time;
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
		started_at: session.start_time ?? new Date().toISOString(),
		duration_seconds:
			session.total_elapsed_time != null ? Math.round(session.total_elapsed_time) : undefined,
		elevation_gain_meters:
			session.total_ascent != null ? Math.round(session.total_ascent) : undefined,
		source: 'fit',
		external_id: await hashContent(buffer)
	};
}

async function hashContent(content: string | ArrayBuffer): Promise<string> {
	const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : content;
	const hash = await crypto.subtle.digest('SHA-256', buffer);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
