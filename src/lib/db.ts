import Dexie, { type Table } from 'dexie';

export type BikeType = 'road' | 'gravel' | 'mtb' | 'commuter' | 'ebike' | 'touring' | 'other';

export interface Bike {
	id?: number;
	name: string;
	make?: string;
	model?: string;
	year?: number;
	type?: BikeType;
	purchase_date?: string;
	purchase_price_cents?: number | null;
	purchase_currency?: string | null;
	starting_odometer_meters: number;
	archived_at?: string | null;
	notes?: string;
	photo_blob?: Blob | null;
	strava_gear_id?: string | null;
	created_at: string;
	updated_at: string;
}

export interface Component {
	id?: number;
	type: string;
	name?: string;
	initial_wear_meters: number;
	retired_at?: string | null;
	replaced_by_component_id?: number | null;
	replacement_interval_distance_meters_override?: number | null;
	replacement_interval_time_days_override?: number | null;
	wear_multipliers_override?: Record<string, number> | null;
	purchase_price_cents?: number | null;
	purchase_currency?: string | null;
	notes?: string;
	created_at: string;
	updated_at: string;
}

export interface Installation {
	id?: number;
	component_id: number;
	bike_id: number;
	installed_at: string;
	installed_at_tz: string;
	removed_at?: string | null;
	removed_at_tz?: string | null;
	notes?: string;
	created_at: string;
	updated_at: string;
}

export type RideSource = 'manual' | 'gpx' | 'fit' | 'strava';

export interface Ride {
	id?: number;
	bike_id: number;
	started_at: string;
	started_at_tz: string;
	distance_meters: number;
	duration_seconds?: number;
	elevation_gain_meters?: number | null;
	conditions: string[];
	source: RideSource;
	external_id?: string | null;
	notes?: string;
	created_at: string;
	updated_at: string;
}

export type ServiceAction = 'serviced' | 'inspected' | 'noted';

export interface ServiceLogEntry {
	id?: number;
	component_id: number;
	bike_id: number;
	performed_at: string;
	performed_at_tz: string;
	action: ServiceAction;
	odometer_meters_at_service?: number;
	notes?: string;
	created_at: string;
	updated_at: string;
}

export interface CustomComponentType {
	type: string;
	label: string;
	category: string;
	default_distance_meters?: number | null;
	default_time_days?: number | null;
	default_inspection_distance_meters?: number | null;
	default_inspection_time_days?: number | null;
	default_wear_multipliers?: Record<string, number> | null;
	notes?: string;
	created_at: string;
	updated_at: string;
}

export interface StravaAuth {
	id: 1;
	client_id: string;
	client_secret: Uint8Array;
	access_token: Uint8Array;
	refresh_token: Uint8Array;
	expires_at: number;
	athlete_id: number;
	athlete_username: string;
	measurement_preference: 'feet' | 'meters';
	last_sync_at?: number | null;
	last_sync_activity_id?: number | null;
	last_sync_error?: string | null;
}

export interface Setting {
	key: string;
	value: unknown;
	updated_at: string;
}

export interface ErrorLogEntry {
	id?: number;
	timestamp: string;
	code: string;
	message: string;
	context?: Record<string, unknown>;
	stack?: string;
	user_agent: string;
	app_version: string;
}

export class TruingDB extends Dexie {
	bikes!: Table<Bike, number>;
	components!: Table<Component, number>;
	installations!: Table<Installation, number>;
	rides!: Table<Ride, number>;
	service_log!: Table<ServiceLogEntry, number>;
	custom_component_types!: Table<CustomComponentType, string>;
	strava_auth!: Table<StravaAuth, number>;
	settings!: Table<Setting, string>;
	error_log!: Table<ErrorLogEntry, number>;

	constructor() {
		super('truing');
		this.version(1).stores({
			bikes: '++id, name, archived_at, type, strava_gear_id',
			components: '++id, type, retired_at, replaced_by_component_id',
			installations:
				'++id, component_id, bike_id, installed_at, removed_at, [bike_id+removed_at], [component_id+removed_at]',
			rides: '++id, bike_id, started_at, [bike_id+started_at], external_id, source, *conditions',
			service_log:
				'++id, component_id, bike_id, performed_at, action, [bike_id+performed_at], [component_id+performed_at]',
			custom_component_types: 'type',
			strava_auth: 'id',
			settings: 'key',
			error_log: '++id, timestamp, code'
		});
	}
}

export const db = new TruingDB();
