import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { db } from '$lib/db';

export type ShortcutMode = 'none' | 'gmail' | 'vim';

let mode: ShortcutMode = 'none';
let pendingChord: string | null = null;
let chordTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadShortcutMode(): Promise<void> {
	const setting = await db.settings.get('keyboard_shortcut_mode');
	mode = (setting?.value as ShortcutMode) ?? 'none';
}

export async function setShortcutMode(newMode: ShortcutMode): Promise<void> {
	mode = newMode;
	await db.settings.put({
		key: 'keyboard_shortcut_mode',
		value: newMode,
		updated_at: new Date().toISOString()
	});
}

export function getShortcutMode(): ShortcutMode {
	return mode;
}

function isTextInput(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function handleShortcutKeyDown(e: KeyboardEvent): void {
	if (mode === 'none') return;
	if (isTextInput(e.target)) return;
	if (e.metaKey || e.ctrlKey || e.altKey) return;

	if (mode === 'gmail') handleGmail(e);
	else if (mode === 'vim') handleVim(e);
}

function handleGmail(e: KeyboardEvent): void {
	if (pendingChord === 'g') {
		clearChordTimer();
		pendingChord = null;
		switch (e.key) {
			case 'd':
				e.preventDefault();
				goto(resolve('/'));
				return;
			case 'b':
				e.preventDefault();
				goto(resolve('/bikes'));
				return;
			case 'r':
				e.preventDefault();
				goto(resolve('/rides'));
				return;
			case 's':
				e.preventDefault();
				goto(resolve('/settings'));
				return;
		}
		return;
	}

	switch (e.key) {
		case 'g':
			e.preventDefault();
			pendingChord = 'g';
			chordTimer = setTimeout(() => {
				pendingChord = null;
			}, 1000);
			return;
		case 'c':
			e.preventDefault();
			handleCreate();
			return;
	}
}

function handleVim(e: KeyboardEvent): void {
	if (pendingChord === 'g' && e.key === 'g') {
		clearChordTimer();
		pendingChord = null;
		e.preventDefault();
		window.scrollTo(0, 0);
		return;
	}

	switch (e.key) {
		case 'j':
			e.preventDefault();
			window.scrollBy(0, 64);
			return;
		case 'k':
			e.preventDefault();
			window.scrollBy(0, -64);
			return;
		case 'h':
			e.preventDefault();
			history.back();
			return;
		case 'l':
			e.preventDefault();
			history.forward();
			return;
		case 'o':
			e.preventDefault();
			handleCreate();
			return;
		case 'G':
			e.preventDefault();
			window.scrollTo(0, document.body.scrollHeight);
			return;
		case 'g':
			pendingChord = 'g';
			chordTimer = setTimeout(() => {
				pendingChord = null;
			}, 500);
			return;
	}
}

function handleCreate(): void {
	const path = window.location.pathname;
	if (path === '/rides' || path === '/') goto(resolve('/rides/new'));
	else if (path === '/bikes') goto(resolve('/bikes/new'));
}

function clearChordTimer(): void {
	if (chordTimer) {
		clearTimeout(chordTimer);
		chordTimer = null;
	}
}
