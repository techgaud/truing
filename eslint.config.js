import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{ ignores: ['android/**', 'ios/**', 'build/**'] },
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		// Studio banned patterns (Osgood ENGINEERING.md parts 5 and 8). These are
		// fail-closed gates, not conventions: the codebase is clean today only by
		// discipline, and discipline is what the gates exist to replace.
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/ban-ts-comment': [
				'error',
				{ 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true }
			],
			'no-console': 'error',
			'no-eval': 'error',
			'no-restricted-properties': [
				'error',
				{
					object: 'Math',
					property: 'random',
					message:
						'Math.random is banned. Use crypto.getRandomValues for any randomness that needs to be unpredictable.'
				}
			]
		}
	},
	{
		// Build and CI scripts are node tools that report to the terminal. The
		// no-console ban is for app runtime code, not for these.
		files: ['scripts/**', '**/*.config.js', '**/*.config.ts'],
		rules: { 'no-console': 'off' }
	}
);
