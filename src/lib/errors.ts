import { db } from './db';
import { APP_VERSION } from './version';

export const ERR = {
	E1001: 'Dexie failed to open database',
	E1002: 'Dexie migration failed',
	E1003: 'Canary row missing on startup (eviction detected)',
	E1004: 'Decrypt failed on strava_auth row',
	E1005: 'Strava OAuth code exchange failed',
	E1006: 'Strava refresh token expired',
	E1007: 'Strava API returned 5xx after max retries',
	E1008: 'Strava API 401 after token refresh',
	E1009: 'Import file checksum mismatch',
	E1010: 'Import file schema_version newer than app',
	E1011: 'Component type in DB missing from service_intervals.json',
	E1012: 'Unhandled sync promise rejection'
} as const;

export class TruingError extends Error {
	constructor(
		public code: keyof typeof ERR,
		public context?: Record<string, unknown>
	) {
		super(`${code}: ${ERR[code]}`);
		this.name = 'TruingError';
	}
}

const MAX_LOG_ENTRIES = 50;

export async function logError(
	code: string,
	message: string,
	context?: Record<string, unknown>,
	stack?: string
): Promise<void> {
	try {
		await db.error_log.add({
			timestamp: new Date().toISOString(),
			code,
			message,
			context,
			stack,
			user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
			app_version: APP_VERSION
		});
		const count = await db.error_log.count();
		if (count > MAX_LOG_ENTRIES) {
			const excess = await db.error_log
				.orderBy('id')
				.limit(count - MAX_LOG_ENTRIES)
				.primaryKeys();
			await db.error_log.bulkDelete(excess);
		}
	} catch {
		// error log writes must never themselves throw
	}
}

export function installGlobalHandlers(): void {
	window.addEventListener('error', (event) => {
		if (event.error instanceof TruingError) {
			logError(event.error.code, event.error.message, event.error.context, event.error.stack);
		} else {
			logError('E0000', event.message, undefined, event.error?.stack);
		}
	});

	window.addEventListener('unhandledrejection', (event) => {
		const err = event.reason;
		if (err instanceof TruingError) {
			logError(err.code, err.message, err.context, err.stack);
		} else {
			const message = err instanceof Error ? err.message : String(err);
			const stack = err instanceof Error ? err.stack : undefined;
			logError('E1012', message, undefined, stack);
		}
	});
}
