<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	export let minecraftClientsList: Array<any>;
	export let getStatusColor: (status: string) => { textColor: string; bgColor: string };
	export let formatTimestamp: (date: Date) => string;
	// showPanel is handled by CollapsiblePanel
</script>

<div class="rounded-lg border border-slate-700 bg-slate-800 shadow-lg">
	<div
		class="flex w-full items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 text-white"
	>
		<div class="flex items-center space-x-2">
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20">
				<svg class="h-3 w-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
					></path>
				</svg>
			</div>
			<h3 class="text-sm font-bold">Clients ({minecraftClientsList.length})</h3>
		</div>
	</div>
	<div class="h-full overflow-scroll border-t border-slate-600/50 bg-slate-900/50 p-4">
		{#if minecraftClientsList.length === 0}
			<div class="py-6 text-center">
				<div
					class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/50"
				>
					<svg class="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						></path>
					</svg>
				</div>
				<p class="text-xs text-slate-400">No clients connected</p>
			</div>
		{:else}
			<div class="max-h-40 space-y-2 overflow-y-auto">
				{#each minecraftClientsList as client (client.id)}
					<div
						class="rounded border border-slate-700/50 bg-slate-800/50 p-3"
						in:fly={{ y: 20, duration: 300, delay: 300 }}
						out:fade={{ duration: 300 }}
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center space-x-2">
								<span class="flex h-2 w-2 rounded-full {getStatusColor(client.status).bgColor}"
								></span>
								<div>
									{#if client.displayName}
										<p class="truncate text-xs font-semibold text-white">{client.displayName}</p>
										<p class="font-mono text-xs text-slate-400">({client.id.substring(0, 8)})</p>
									{:else}
										<p class="font-mono text-xs font-semibold text-white">
											{client.id.substring(0, 8)}
										</p>
									{/if}
								</div>
							</div>
							<span class="text-xs font-medium uppercase {getStatusColor(client.status).textColor}"
								>{client.status}</span
							>
						</div>
						<div class="mt-2 flex justify-between gap-2 text-xs">
							<div>
								<span class="text-slate-400">Address:</span>
								<span class="font-mono text-slate-300">{client.address}:{client.port}</span>
							</div>
							<div>
								<span class="text-slate-400">Last Active:</span>
								<span class="font-semibold text-slate-300"
									>{formatTimestamp(new Date(client.lastActivity))}</span
								>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
