<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { db, type Component, type Installation } from '$lib/db';
	import { toast } from '$lib/toast';
	import { pickPhoto, resizeImage } from '$lib/photo';
	import { archiveShareText, bikeOdometer, shareText } from '$lib/share';

	let {
		bikeId,
		bikeName,
		bikeInfo,
		bikePhoto,
		installed,
		onclose
	}: {
		bikeId: number;
		bikeName: string;
		bikeInfo?: { make?: string; model?: string; year?: number };
		bikePhoto?: Blob | null;
		installed?: Array<{ installation: Installation; component: Component | undefined }>;
		onclose: () => void;
	} = $props();

	const reasons = [
		{ value: 'sold', label: 'Sold' },
		{ value: 'traded', label: 'Traded' },
		{ value: 'donated', label: 'Donated' },
		{ value: 'retired', label: 'Retired' },
		{ value: 'stripped', label: 'Stripped for parts' },
		{ value: 'stolen', label: 'Stolen' },
		{ value: 'totaled', label: 'Totaled' }
	];

	let reason = $state('retired');
	let salePrice = $state<number | ''>('');
	let saleCurrency = $state('USD');
	let tradeName = $state('');
	let tradeType = $state('');
	let stripChecked = $state<boolean[]>([]);
	let photo = $state<Blob | null>(null);
	let photoPreview = $state<string | null>(null);
	let tradePhoto = $state<Blob | null>(null);
	let tradePhotoPreview = $state<string | null>(null);

	$effect(() => {
		if (reason === 'stripped' && installed) {
			stripChecked = installed.map(() => true);
		}
	});

	async function handlePhoto() {
		try {
			const blob = await pickPhoto();
			if (!blob) return;
			const resized = await resizeImage(blob);
			photo = resized;
			photoPreview = URL.createObjectURL(resized);
		} catch (err) {
			toast.error(`Photo failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	function removePhoto() {
		if (photoPreview) URL.revokeObjectURL(photoPreview);
		photo = null;
		photoPreview = null;
	}

	async function handleTradePhoto() {
		try {
			const blob = await pickPhoto();
			if (!blob) return;
			const resized = await resizeImage(blob);
			tradePhoto = resized;
			tradePhotoPreview = URL.createObjectURL(resized);
		} catch (err) {
			toast.error(`Photo failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	function removeTradePhoto() {
		if (tradePhotoPreview) URL.revokeObjectURL(tradePhotoPreview);
		tradePhoto = null;
		tradePhotoPreview = null;
	}

	async function handleRetire() {
		try {
			const totalMeters = await bikeOdometer(bikeId);
			const now = new Date().toISOString();

			await db.bikes.update(bikeId, {
				archived_at: now,
				archive_reason: reason,
				sale_price_cents:
					reason === 'sold' && salePrice !== '' ? Math.round(Number(salePrice) * 100) : null,
				sale_currency: reason === 'sold' && salePrice !== '' ? saleCurrency : null,
				updated_at: now
			});

			if (reason === 'traded' && tradeName.trim()) {
				await db.bikes.add({
					name: tradeName.trim(),
					type: (tradeType as import('$lib/db').BikeType) || undefined,
					starting_odometer_meters: 0,
					photo_blob: tradePhoto,
					created_at: now,
					updated_at: now
				});
			}

			if (reason === 'stripped' && installed) {
				for (let i = 0; i < installed.length; i++) {
					if (stripChecked[i] && installed[i].installation?.id) {
						await db.installations.update(installed[i].installation.id!, {
							removed_at: now,
							updated_at: now
						});
					}
				}
			}

			onclose();

			const sharePhoto = photo ?? bikePhoto ?? undefined;
			if (reason === 'stripped') {
				toast.success(`${bikeName} stripped for parts.`, {
					label: 'Share',
					onclick: () => shareText('', sharePhoto)
				});
			} else {
				const text = archiveShareText(
					reason,
					bikeName,
					totalMeters,
					bikeInfo,
					tradeName.trim() || undefined
				);
				toast.success(`${bikeName} retired.`, {
					label: 'Share',
					onclick: () => shareText(text, sharePhoto)
				});
			}
			goto(resolve('/bikes'));
		} catch (err) {
			toast.error(`Retire failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="retire-title"
		class="w-full max-w-sm rounded-card bg-surface-elevated p-6"
	>
		<h2 id="retire-title" class="text-lg font-semibold">Retire bike</h2>
		<p class="mt-2 text-sm text-fg-muted">
			Why are you retiring {bikeName}? The bike and all its history will be preserved.
		</p>
		<div class="mt-4 space-y-2">
			{#each reasons as r (r.value)}
				<label class="flex items-center gap-3 text-sm">
					<input type="radio" bind:group={reason} value={r.value} />
					{r.label}
				</label>
			{/each}
		</div>

		{#if reason === 'sold'}
			<div class="mt-4">
				<label for="retire-sale-price" class="block text-sm font-medium"
					>Sale price (optional)</label
				>
				<div class="mt-1 flex gap-2">
					<input
						id="retire-sale-price"
						type="number"
						min="0"
						step="0.01"
						bind:value={salePrice}
						class="flex-1 rounded-button border border-border bg-surface px-3 py-2"
					/>
					<select
						bind:value={saleCurrency}
						aria-label="Currency"
						class="rounded-button border border-border bg-surface px-3 py-2"
					>
						<option value="USD">USD</option>
						<option value="EUR">EUR</option>
						<option value="GBP">GBP</option>
						<option value="CAD">CAD</option>
						<option value="AUD">AUD</option>
						<option value="JPY">JPY</option>
					</select>
				</div>
			</div>
		{/if}

		{#if reason === 'traded'}
			<div class="mt-4 space-y-3">
				<p class="text-sm font-medium">What did you trade it for?</p>
				<div>
					<label for="retire-trade-name" class="block text-sm text-fg-muted">Bike name</label>
					<input
						id="retire-trade-name"
						type="text"
						bind:value={tradeName}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="retire-trade-type" class="block text-sm text-fg-muted">Type</label>
					<select
						id="retire-trade-type"
						bind:value={tradeType}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					>
						<option value="">None</option>
						<option value="road">Road</option>
						<option value="gravel">Gravel</option>
						<option value="mtb">MTB</option>
						<option value="commuter">Commuter</option>
						<option value="ebike">E-bike</option>
						<option value="touring">Touring</option>
						<option value="other">Other</option>
					</select>
				</div>
				<div>
					<p class="text-sm text-fg-muted">Photo of the new bike (optional)</p>
					{#if tradePhotoPreview}
						<img
							src={tradePhotoPreview}
							alt="New bike"
							class="mt-1 h-24 w-full rounded-card object-cover"
						/>
						<button type="button" onclick={removeTradePhoto} class="mt-1 text-sm text-danger">
							Remove
						</button>
					{:else}
						<button
							type="button"
							onclick={handleTradePhoto}
							class="mt-1 rounded-button border border-border px-4 py-2 text-sm font-medium"
						>
							Add photo
						</button>
					{/if}
				</div>
			</div>
		{/if}

		{#if reason === 'stripped' && installed && installed.length > 0}
			<div class="mt-4">
				<p class="text-sm font-medium">Move to parts bin</p>
				<ul class="mt-2 max-h-48 space-y-1 overflow-y-auto">
					{#each installed as row, i (row.installation.id)}
						{#if row.component}
							<li>
								<label class="flex items-center gap-3 text-sm">
									<input type="checkbox" bind:checked={stripChecked[i]} />
									<span>{row.component.name ?? row.component.type}</span>
								</label>
							</li>
						{/if}
					{/each}
				</ul>
			</div>
		{/if}

		<div class="mt-4">
			<p class="text-sm font-medium">
				{reason === 'traded' ? 'Farewell photo (optional)' : 'Photo (optional)'}
			</p>
			{#if photoPreview}
				<img
					src={photoPreview}
					alt="Retire photo"
					class="mt-1 h-24 w-full rounded-card object-cover"
				/>
				<button type="button" onclick={removePhoto} class="mt-1 text-sm text-danger">
					Remove
				</button>
			{:else}
				<button
					type="button"
					onclick={handlePhoto}
					class="mt-1 rounded-button border border-border px-4 py-2 text-sm font-medium"
				>
					Add photo
				</button>
			{/if}
		</div>

		<div class="mt-6 flex flex-wrap gap-3">
			<button
				type="button"
				onclick={handleRetire}
				class="rounded-button bg-danger px-5 py-2 font-medium text-white"
			>
				Retire
			</button>
			<button
				type="button"
				onclick={onclose}
				class="rounded-button px-5 py-2 font-medium text-fg-muted"
			>
				Cancel
			</button>
		</div>
	</div>
</div>
