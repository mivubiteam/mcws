<script lang="ts">
	export let connectionStatus: string;
	export let minecraftStatus: string;
	export let getStatusColor: (status: string) => { textColor: string; bgColor: string };
</script>

<div
	class="flex h-full flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-lg"
>
	<div
		class="flex w-full items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 text-white"
	>
		<div class="flex items-center space-x-2.5">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/30">
				<svg
					class="h-3.5 w-3.5 text-sky-400"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</div>
			<h3 class="text-md font-semibold">Connection Status</h3>
		</div>
	</div>
	<div
		class="grid flex-grow grid-cols-2 items-center gap-4 border-t border-slate-600/50 bg-slate-900/50 p-4"
	>
		<div class="flex flex-col items-center justify-center space-y-2">
			<span class="text-sm font-medium text-slate-300">Web UI</span>
			<div class="flex items-center space-x-2">
				<span class="flex h-3 w-3 rounded-full {getStatusColor(connectionStatus).bgColor}"></span>
				<span class="text-lg font-semibold {getStatusColor(connectionStatus).textColor}"
					>{connectionStatus}</span
				>
			</div>
		</div>

		<div class="flex flex-col items-center justify-center space-y-2">
			<span class="text-sm font-medium text-slate-300">Minecraft</span>
			<div class="flex items-center space-x-2">
				<span class="flex h-3 w-3 rounded-full {getStatusColor(minecraftStatus).bgColor}"></span>
				<span class="text-lg font-semibold {getStatusColor(minecraftStatus).textColor}"
					>{minecraftStatus}</span
				>
			</div>
		</div>
	</div>
</div>
