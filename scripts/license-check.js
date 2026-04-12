#!/usr/bin/env node

import { readdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';

const ALLOWED = new Set([
	'MIT',
	'ISC',
	'BSD-2-Clause',
	'BSD-3-Clause',
	'Apache-2.0',
	'0BSD',
	'Unlicense',
	'CC0-1.0',
	'WTFPL',
	'BlueOak-1.0.0',
	'Python-2.0',
	'AGPL-3.0-or-later',
	'GPL-3.0-or-later',
	'LGPL-3.0-or-later',
	'CC-BY-3.0',
	'CC-BY-4.0',
	'MPL-2.0'
]);

// Returns { ok: true } if the SPDX expression is satisfied by the allow list.
// OR means any branch is fine. AND means all branches must be fine.
function spdxAllowed(expr) {
	if (!expr) return false;
	const cleaned = expr.replace(/[()]/g, '');
	if (/\bOR\b/i.test(cleaned)) {
		return cleaned.split(/\s+OR\s+/i).some((s) => ALLOWED.has(s.trim()));
	}
	if (/\bAND\b/i.test(cleaned)) {
		return cleaned.split(/\s+AND\s+/i).every((s) => ALLOWED.has(s.trim()));
	}
	return ALLOWED.has(cleaned.trim());
}

async function readPkg(dir) {
	try {
		const raw = await readFile(join(dir, 'package.json'), 'utf8');
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

// pnpm stores packages in node_modules/.pnpm/<name>@<version>/node_modules/<name>/
// Each .pnpm entry dir contains a node_modules with the actual package(s)
async function scanPnpmStore(pnpmDir) {
	const results = [];
	const seen = new Set();
	let entries;
	try {
		entries = await readdir(pnpmDir, { withFileTypes: true });
	} catch {
		return results;
	}

	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) {
			continue;
		}
		const innerNm = join(pnpmDir, entry.name, 'node_modules');
		const pkgs = await scanDir(innerNm);
		for (const pkg of pkgs) {
			const key = `${pkg.name}@${pkg.version}`;
			if (!seen.has(key)) {
				seen.add(key);
				results.push(pkg);
			}
		}
	}
	return results;
}

async function scanDir(base) {
	const results = [];
	let entries;
	try {
		entries = await readdir(base, { withFileTypes: true });
	} catch {
		return results;
	}

	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
		const full = join(base, entry.name);

		if (entry.name.startsWith('@')) {
			const scoped = await scanDir(full);
			results.push(...scoped);
		} else {
			const resolved = await realpath(full).catch(() => full);
			const pkg = await readPkg(resolved);
			if (pkg && pkg.name) {
				// Handle old { licenses: [{ type: "MIT" }] } format
				let lic = pkg.license;
				if (!lic && Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
					lic = pkg.licenses.map((l) => l.type || l).join(' OR ');
				}
				results.push({ name: pkg.name, version: pkg.version, license: lic });
			}
		}
	}
	return results;
}

const nodeModules = join(process.cwd(), 'node_modules');
const pnpmDir = join(nodeModules, '.pnpm');
const packages = await scanPnpmStore(pnpmDir);

const failures = [];
for (const pkg of packages) {
	const raw = typeof pkg.license === 'object' ? pkg.license?.type : pkg.license;

	if (!raw) {
		failures.push({ name: pkg.name, version: pkg.version, license: '(none)' });
		continue;
	}

	if (!spdxAllowed(raw)) {
		failures.push({ name: pkg.name, version: pkg.version, license: raw });
	}
}

if (failures.length === 0) {
	console.log(`license-check: ${packages.length} packages scanned, all OK`);
	process.exit(0);
} else {
	console.error(
		`license-check: ${packages.length} scanned, ${failures.length} with disallowed licenses:\n`
	);
	for (const f of failures) {
		console.error(`  ${f.name}@${f.version}  ->  ${f.license}`);
	}
	process.exit(1);
}
