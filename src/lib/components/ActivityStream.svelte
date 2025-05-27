<script lang="ts">
	import CollapsiblePanel from './CollapsiblePanel.svelte';
	import { fly, fade } from 'svelte/transition';
	export let activityStreamMessages: Array<any>;
	export let formatTimestamp: (date: Date) => string;
</script>

<CollapsiblePanel
	title="Real-time Activity Stream"
	iconPath="M13 10V3L4 14h7v7l9-11h-7z"
	iconBgClass="bg-blue-500/20"
	iconFgClass="text-blue-400"
>
	<div class="h-72 overflow-y-auto rounded-md border border-slate-700/50 bg-slate-900 p-3">
		{#if activityStreamMessages.length === 0}
			<div class="flex h-full flex-col items-center justify-center text-center">
				<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-700/50">
					<svg class="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
						></path>
					</svg>
				</div>
				<p class="text-sm text-slate-400">No activity yet. Connect a Minecraft client.</p>
			</div>
		{:else}
			{#each activityStreamMessages as activity (activity.id)}
				<div
					class="mb-2 rounded border border-slate-700/30 bg-slate-800/50 p-3 transition-colors hover:bg-slate-800/70"
					in:fly={{ y: 20, duration: 300, delay: 300 }}
					out:fade={{ duration: 300 }}
				>
					<div class="mb-2 flex items-center justify-between">
						<span class="font-mono text-xs text-slate-500">
							{formatTimestamp(activity.timestamp)}
						</span>
						<span
							class="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold tracking-wide text-blue-300 uppercase"
						>
							{activity.type.replace('_', ' ')}
						</span>
					</div>
					<p class="text-sm leading-relaxed text-slate-300">
						Client <strong class="font-mono text-purple-400">
							{activity.clientId.substring(0, 8)}
						</strong>: {#if activity.type === 'connection'}
							Connected from {activity.data.address}:{activity.data.port}
						{:else if activity.type === 'disconnection'}
							Disconnected. Total time: {activity.data.totalConnectionTime
								? (activity.data.totalConnectionTime / 1000).toFixed(1) + 's'
								: 'N/A'}
						{:else if activity.type === 'player_message'}
							Player <strong class="text-green-400">
								{activity.playerName || activity.data.sender}
							</strong>: {activity.data.message}
						{:else if activity.type === 'world_snapshot'}
							World Snapshot for <strong class="text-orange-400">
								{activity.data.projectName} ({activity.data.worldId})
							</strong>
							with {activity.data.playerCount} players.
						{:else if activity.type === 'data_update'}
							Received data: {activity.data.messageType} / {activity.data.eventName}
						{:else}
							{JSON.stringify(activity.data)}
						{/if}
					</p>
				</div>
			{/each}
		{/if}
	</div>
</CollapsiblePanel>
