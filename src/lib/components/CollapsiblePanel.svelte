<script lang="ts">
	export let title: string;
	export let iconPath: string | null = null;
	export let iconBgClass: string = 'bg-blue-500/20';
	export let iconFgClass: string = 'text-blue-400';
	export let initiallyOpen: boolean = true;
	export let compact: boolean = false;

	let showPanel = initiallyOpen;
</script>

<div class="overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-lg">
	<button
		on:click={() => (showPanel = !showPanel)}
		class="flex w-full items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 {compact
			? 'px-4 py-3'
			: 'px-6 py-4'} text-white transition-colors hover:from-slate-700 hover:to-slate-600"
	>
		<div class="flex items-center space-x-3">
			{#if iconPath}
				<div
					class="flex {compact
						? 'h-6 w-6'
						: 'h-8 w-8'} items-center justify-center rounded-full {iconBgClass}"
				>
					<svg
						class="{compact ? 'h-3 w-3' : 'h-4 w-4'} {iconFgClass}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPath}
						></path>
					</svg>
				</div>
			{/if}
			<h2 class="{compact ? 'text-lg' : 'text-xl'} font-bold">{title}</h2>
			<slot name="header-extra" />
		</div>
		<svg
			class="h-5 w-5 transform transition-transform duration-300 {showPanel ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
			></path>
		</svg>
	</button>

	{#if showPanel}
		<div class=" border-t border-slate-600/50 bg-slate-900/50 {compact ? 'p-4' : 'p-6'}">
			<slot />
		</div>
	{/if}
</div>
