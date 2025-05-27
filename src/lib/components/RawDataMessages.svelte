<script lang="ts">
	import CollapsiblePanel from './CollapsiblePanel.svelte';
	import { fly, fade } from 'svelte/transition';
	export let dataMessages: Array<{ timestamp: Date; data: any }>;
	export let formatTimestamp: (date: Date) => string;
	export let formatData: (data: any) => string;
	export let getMessageStyle: (data: any) => string;

	let copiedStates: Record<string, boolean> = {};

	async function copyToClipboard(text: string, messageKey: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedStates[messageKey] = true;
			setTimeout(() => {
				copiedStates[messageKey] = false;
			}, 2000); // Reset after 2 seconds
		} catch (err) {
			console.error('Failed to copy text: ', err);
			// Optionally, provide user feedback for error
		}
	}

	function getMessageKey(message: { timestamp: Date; data: any }): string {
		return message.timestamp.toISOString() + JSON.stringify(message.data);
	}
</script>

<CollapsiblePanel
	title="Raw Data Messages"
	iconPath="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
	iconBgClass="bg-red-500/20"
	iconFgClass="text-red-400"
	initiallyOpen={false}
>
	<div class="mb-4 rounded-md border border-slate-700/50 bg-slate-800/50 p-4">
		<h3 class="text-lg font-semibold text-white">Raw Data Stream</h3>
		<p class="text-sm text-slate-400">Underlying data messages from Minecraft clients.</p>
	</div>
	<div class="h-96 overflow-y-auto rounded-md border border-slate-700/50 bg-slate-900 p-4">
		{#if dataMessages.length === 0}
			<div class="flex h-full flex-col items-center justify-center text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-700/50">
					<svg class="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
				</div>
				<p class="text-slate-400">No data received yet. Connect Minecraft to start viewing data.</p>
			</div>
		{:else}
			{#each dataMessages.slice().reverse() as message (getMessageKey(message))}
				{@const messageKey = getMessageKey(message)}
				<div
					class="mb-3 rounded-lg border {getMessageStyle(
						message.data
					)} bg-slate-800/50 p-4 shadow-sm transition-colors hover:opacity-95"
					in:fly={{ y: 20, duration: 300, delay: 20 }}
					out:fade={{ duration: 300 }}
				>
					<div class="mb-5 flex items-center justify-between">
						<span class="font-mono text-xs text-slate-500"
							>{formatTimestamp(message.timestamp)}</span
						>
						<div>
							{#if message.data.header}
								<span
									class="rounded-full bg-purple-600/30 px-2.5 py-1 text-xs font-bold text-purple-300"
								>
									{message.data.header.eventName || message.data.header.messagePurpose || 'Event'}
								</span>
							{/if}
							<button
								on:click={() => copyToClipboard(formatData(message.data), messageKey)}
								class="rounded {getMessageStyle(
									message.data
								)} border px-2 py-1 text-xs text-slate-300 transition-colors"
								aria-label="Copy message data"
							>
								{copiedStates[messageKey] ? 'Copied!' : 'Copy'}
							</button>
						</div>
					</div>
					<div class="mt-2">
						{#if message.data.system}
							<p class="text-slate-300">{message.data.message}</p>
						{:else if message.data.header && message.data.header.eventName === 'PlayerMessage' && message.data.body}
							{#if message.data.body.properties}
								<div class="font-semibold text-white">
									{message.data.body.properties.Sender}:
								</div>
								<div class="whitespace-pre-wrap text-slate-300">
									{message.data.body.properties.Message}
								</div>
							{:else if message.data.body.sender}
								<div class="font-semibold text-white">{message.data.body.sender}:</div>
								<div class="whitespace-pre-wrap text-slate-300">{message.data.body.message}</div>
							{:else}
								<pre
									class="max-h-60 overflow-auto rounded-md border border-slate-700 bg-slate-900/70 p-3 font-mono text-xs whitespace-pre-wrap text-slate-100">{formatData(
										message.data
									)}</pre>
							{/if}
						{:else}
							<pre
								class="max-h-60 overflow-auto rounded-md border border-slate-700 bg-slate-900/70 p-3 font-mono text-xs whitespace-pre-wrap text-slate-100">{formatData(
									message.data
								)}</pre>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</CollapsiblePanel>
