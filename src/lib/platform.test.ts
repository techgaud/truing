// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { isIOSSafari, isStandalonePWA, isCapacitorNative } from './platform';

beforeAll(() => {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn()
		}))
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('isIOSSafari', () => {
	it('returns false for desktop Chrome', () => {
		vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
			'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/120 Safari/537.36'
		);
		expect(isIOSSafari()).toBe(false);
	});

	it('returns true for iPhone Safari', () => {
		vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
		);
		expect(isIOSSafari()).toBe(true);
	});

	it('returns false for Chrome on iOS', () => {
		vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120 Mobile/15E148 Safari/604.1'
		);
		expect(isIOSSafari()).toBe(false);
	});
});

describe('isStandalonePWA', () => {
	it('returns false by default in jsdom', () => {
		expect(isStandalonePWA()).toBe(false);
	});
});

describe('isCapacitorNative', () => {
	it('returns false when Capacitor is not present', () => {
		expect(isCapacitorNative()).toBe(false);
	});
});
