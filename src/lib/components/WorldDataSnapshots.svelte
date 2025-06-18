<script lang="ts">
	import CollapsiblePanel from './CollapsiblePanel.svelte';
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition';

	export let projects: Array<string>;
	export let selectedProject: string;
	export let worldDataSnapshots: Record<string, any>;
	export let filteredSnapshots: Array<[string, any]>; // Corrected type
	export let formatTimestamp: (date: Date) => string;
	export let getPlayerStats: (player: any) => Array<{ key: string; value: any }>;
	let playerDataVisible: Record<string, boolean> = {}; // For player data collapsibility

	const dispatch = createEventDispatcher();

	// Handle selection change and dispatch event
	function handleProjectChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedProject = target.value;
		dispatch('projectChange', selectedProject);
	}

	// Initialize playerDataVisible for new snapshots
	$: {
		filteredSnapshots.forEach(([key, _]) => {
			if (playerDataVisible[key] === undefined) {
				playerDataVisible[key] = false; // Default to collapsed
			}
		});
	}

	function togglePlayerData(key: string) {
		playerDataVisible[key] = !playerDataVisible[key];
	}

	// Helper function to get player data from the CTF structure
	function getPlayerData(snapshot: any): any[] {
		if (snapshot.data && snapshot.data.player_data && Array.isArray(snapshot.data.player_data)) {
			return snapshot.data.player_data;
		}
		return Array.isArray(snapshot.data) ? snapshot.data : [];
	}

	// Helper function to get recent winner
	function getRecentWinner(snapshot: any): string | null {
		if (snapshot.data && snapshot.data.recent_winner) {
			return snapshot.data.recent_winner;
		}
		return null;
	}

	// Helper function to check if this is CTF data structure
	function isCTFData(snapshot: any): boolean {
		return snapshot.data && snapshot.data.player_data && Array.isArray(snapshot.data.player_data);
	}
</script>

<CollapsiblePanel
	title="World Data Snapshots"
	iconPath="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
	iconBgClass="bg-emerald-500/20"
	iconFgClass="text-emerald-400"
>
	<svelte:fragment slot="header-extra">
		<p class="text-sm text-slate-400">
			{Object.keys(worldDataSnapshots).length} snapshot{Object.keys(worldDataSnapshots).length !== 1
				? 's'
				: ''}
		</p>
	</svelte:fragment>

	{#if projects.length > 0}
		<div
			class="mb-6 flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/50 p-4"
		>
			<div class="flex items-center space-x-4">
				<label for="project-filter-component" class="text-sm font-medium text-slate-300"
					>Filter by Project:</label
				>
				<select
					id="project-filter-component"
					value={selectedProject}
					on:change={handleProjectChange}
					class="rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-white transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
				>
					<option value="">All Projects</option>
					{#each projects as project}
						<option value={project}>{project}</option>
					{/each}
				</select>
			</div>
			<div class="rounded-full bg-slate-700/50 px-3 py-1 text-sm text-slate-300">
				{filteredSnapshots.length} result{filteredSnapshots.length !== 1 ? 's' : ''}
			</div>
		</div>
	{/if}

	<div class="min-h-64 space-y-6">
		{#if filteredSnapshots.length === 0}
			<div
				class="flex h-full flex-col items-center justify-center rounded-lg bg-slate-900/50 py-16 text-center"
				in:fade={{ duration: 300 }}
				out:fade={{ duration: 300 }}
			>
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-700/50">
					<svg class="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
				</div>
				<h3 class="mb-2 text-lg font-medium text-white">No World Data Snapshots</h3>
				<p class="text-slate-400">
					Connect to Minecraft and send world data to see snapshots here.
				</p>
			</div>
		{:else}
			{#each filteredSnapshots as [key, snapshot] (key)}
				<div
					class="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-800/30 shadow-lg"
					in:fly={{ y: 20, duration: 300, delay: 20 }}
					out:fade={{ duration: 300 }}
				>
					<div class="bg-gradient-to-r from-slate-800/80 to-slate-700/80 p-6">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h3 class="text-xl font-bold text-white">{snapshot.from.projectName}</h3>
								<p class="text-slate-300">
									World ID: <span class="font-mono text-sm">{snapshot.from.worldId}</span>
								</p>
								{#if snapshot.clientId}
									<p class="mt-1 font-mono text-xs text-purple-400">
										Client: {snapshot.clientId.substring(0, 8)}
									</p>
								{/if}
								{#if getRecentWinner(snapshot)}
									<div class="mt-2">
										<span
											class="inline-flex items-center rounded-full bg-green-700/30 px-3 py-1 text-sm font-medium text-green-300"
										>
											🏆 Recent Winner: {getRecentWinner(snapshot)}
										</span>
									</div>
								{/if}
							</div>
							<div class="text-left sm:text-right">
								<div class="text-sm text-slate-400">Last Updated</div>
								<div class="font-mono text-lg text-white">
									{formatTimestamp(snapshot.timestamp)}
								</div>
							</div>
						</div>
						<div class="mt-4 flex justify-between">
							<button
								on:click={() => togglePlayerData(key)}
								aria-label="Toggle Player Details"
								class="flex items-center rounded-full bg-slate-600/50 px-4 py-2 text-left text-sm font-medium text-slate-300 hover:bg-slate-700/50 focus:outline-none"
							>
								<svg
									class="mr-2 h-4 w-4 text-slate-300"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
									></path>
								</svg>
								<span class="pr-2 font-medium text-white"
									>{getPlayerData(snapshot).length} Player{getPlayerData(snapshot).length !== 1
										? 's'
										: ''}</span
								>

								<svg
									class="h-4 w-4 transform transition-transform {playerDataVisible[key]
										? 'rotate-180'
										: ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									></path>
								</svg>
							</button>
						</div>
					</div>

					{#if playerDataVisible[key]}
						<div class="p-6">
							{#if isCTFData(snapshot)}
								<!-- CTF Data Structure -->
								{#if getPlayerData(snapshot).length > 0}
									<div class="overflow-x-auto">
										<table class="w-full">
											<thead>
												<tr class="border-b border-slate-700/30">
													<th class="pb-3 text-left text-sm font-medium text-slate-300">Player</th>
													<th class="pb-3 text-center text-sm font-medium text-slate-300">Kills</th>
													<th class="pb-3 text-center text-sm font-medium text-slate-300"
														>Destroy</th
													>
													<th class="pb-3 text-center text-sm font-medium text-slate-300">Wins</th>
												</tr>
											</thead>
											<tbody>
												{#each getPlayerData(snapshot) as player}
													<tr class="border-b border-slate-700/20 hover:bg-slate-700/20">
														<td class="py-3">
															<div class="flex items-center space-x-3">
																<img
																	class="h-8 w-8 rounded border border-slate-600"
																	src="https://starlightskins.lunareclipse.studio/render/ultimate/RealSteve/bust?borderHighlight=true&borderHighlightRadius=5"
																	alt={player.name}
																	loading="lazy"
																/>
																<span class="font-medium text-white"
																	>{player.name || 'Unknown'}</span
																>
															</div>
														</td>
														<td class="py-3 text-center">
															<span
																class="inline-flex items-center rounded-full bg-red-700/30 px-2 py-1 text-sm font-medium text-red-300"
															>
																{player.kills || 0}
															</span>
														</td>
														<td class="py-3 text-center">
															<span
																class="inline-flex items-center rounded-full bg-orange-700/30 px-2 py-1 text-sm font-medium text-orange-300"
															>
																{player.destroy || 0}
															</span>
														</td>
														<td class="py-3 text-center">
															<span
																class="inline-flex items-center rounded-full bg-green-700/30 px-2 py-1 text-sm font-medium text-green-300"
															>
																{player.wins || 0}
															</span>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{:else}
									<div
										class="flex flex-col items-center justify-center py-8 text-center text-slate-400"
									>
										<div
											class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-700/50"
										>
											<svg
												class="h-6 w-6 text-slate-500"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
												></path>
											</svg>
										</div>
										<p>No player data available for this CTF match</p>
									</div>
								{/if}
							{:else}
								<!-- Original Data Structure -->
								{#if Array.isArray(snapshot.data) && snapshot.data.length > 0}
									<div class="grid gap-6">
										{#each snapshot.data as player (player.uuid || player.name)}
											<div
												class="rounded-lg border border-slate-700/30 bg-slate-800/40 p-6 transition-colors hover:bg-slate-800/60"
											>
												<div class="mb-4 flex items-center gap-3">
													<img
														class="h-10 w-10 rounded-lg border border-slate-600"
														src="https://starlightskins.lunareclipse.studio/render/ultimate/{player.name}/bust?borderHighlight=true&borderHighlightRadius=5"
														alt={player.name}
														loading="lazy"
													/>
													<div>
														<h4 class="font-semibold text-white">
															{player.name || 'Unknown Player'}
														</h4>
														<p class="font-mono text-sm text-slate-400">{player.uuid}</p>
													</div>
												</div>

												{#if player.scores && Object.keys(player.scores).length > 0}
													<div class="rounded-lg bg-slate-700/40 p-4">
														<h5 class="mb-3 flex items-center font-medium text-slate-300">
															<svg
																class="mr-2 h-4 w-4"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
																></path>
															</svg>
															Player Statistics
														</h5>
														<div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
															{#each getPlayerStats(player) as stat (stat.key)}
																<div
																	class="rounded-md border border-slate-600/50 bg-slate-700/70 p-3 text-center transition-colors hover:bg-slate-700"
																>
																	<div
																		class="text-xs font-medium tracking-wide text-slate-400 uppercase"
																	>
																		{stat.key}
																	</div>
																	<div class="mt-1 text-xl font-bold text-white">
																		{stat.value}
																	</div>
																</div>
															{/each}
														</div>
													</div>
												{:else}
													<div class="rounded-lg bg-slate-700/40 p-4 text-center text-slate-400">
														No statistics available for this player
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<div
										class="flex flex-col items-center justify-center py-8 text-center text-slate-400"
									>
										<div
											class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-700/50"
										>
											<svg
												class="h-6 w-6 text-slate-500"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
												></path>
											</svg>
										</div>
										<p>No player data available</p>
									</div>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</CollapsiblePanel>
