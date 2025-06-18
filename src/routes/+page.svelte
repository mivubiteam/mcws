<script lang="ts">
	import type { DefaultEventsMap } from '@socket.io/component-emitter';
	import { io, Socket } from 'socket.io-client';
	import { onMount, onDestroy } from 'svelte';
	import StatusCards from '$lib/components/StatusCards.svelte';
	import InstructionsCard from '$lib/components/InstructionsCard.svelte';
	import ConnectionsPanel from '$lib/components/ConnectionsPanel.svelte';
	import ActivityStream from '$lib/components/ActivityStream.svelte';
	import WorldDataSnapshots from '$lib/components/WorldDataSnapshots.svelte';
	import RawDataMessages from '$lib/components/RawDataMessages.svelte';

	// Data state
	let dataMessages: Array<{ timestamp: Date; data: any }> = [];
	let connectionStatus = 'Disconnected';
	let minecraftStatus = 'Disconnected';
	let minecraftServerInfo = { address: 'Unknown', port: 0, connected: false };
	let socket: Socket<DefaultEventsMap, DefaultEventsMap>;

	// New state for multi-client tracking
	let minecraftClientsList: Array<any> = [];
	let activityStreamMessages: Array<any> = [];

	// Calculated count of connected clients
	$: connectedClientsCount = minecraftClientsList.filter(
		(c) => c.status?.toLowerCase() === 'connected'
	).length;

	let worldDataSnapshots: Record<string, any> = {};
	let selectedProject = '';

	// Get unique projects for filtering
	$: projects = Object.values(worldDataSnapshots)
		.map((snapshot: any) => snapshot.from.projectName)
		.filter((name, index, arr) => arr.indexOf(name) === index);

	onMount(() => {
		// Initialize socket connection
		socket = io({
			reconnectionAttempts: 5,
			timeout: 10000
		});

		// Connection events
		socket.on('connect', () => {
			connectionStatus = 'Connected';
			console.log('Connected to server with ID:', socket.id);
		});

		socket.on('disconnect', () => {
			connectionStatus = 'Disconnected';
			minecraftStatus = 'Disconnected';
			minecraftServerInfo = { address: 'Unknown', port: 0, connected: false };
			console.log('Disconnected from server');
		});

		socket.on('connect_error', (error) => {
			connectionStatus = 'Connection Error';
			console.error('Connection error:', error);
		});

		socket.on('minecraft_status', (status) => {
			console.log('Minecraft status:', status);
			minecraftStatus = status.connected ? 'Connected' : 'Disconnected';
			minecraftServerInfo = status.serverInfo || { address: 'Unknown', port: 0, connected: false };
			addSystemMessage(status.message);
		});

		socket.on('minecraft_data', (message) => {
			console.log('Minecraft data:', message);

			if (message.type === 'world_data_snapshot' && message.data) {
				const { from, data, clientId } = message.data;

				if (from && from.projectName && from.worldId) {
					const key = `${from.projectName}-${from.worldId}`;

					worldDataSnapshots = {
						...worldDataSnapshots,
						[key]: {
							from,
							data,
							timestamp: new Date(message.timestamp || Date.now()),
							clientId
						}
					};
				}
			}

			dataMessages = [
				...dataMessages,
				{
					timestamp: new Date(message.timestamp || Date.now()),
					data: message.data
				}
			];
		});

		socket.on('error', (error) => {
			console.error('Error from server:', error);
			addSystemMessage(`Error: ${error.message}`);
		});

		socket.on('clients_update', (data) => {
			console.log('Clients update:', data);
			minecraftClientsList = data.clients || [];
			const connectedClients = minecraftClientsList.filter((c) => c.status === 'connected').length;
			minecraftStatus = connectedClients > 0 ? 'Connected' : 'Disconnected';
			if (minecraftClientsList.length > 0 && minecraftClientsList[0].status === 'connected') {
				minecraftServerInfo = {
					address: minecraftClientsList[0].address,
					port: minecraftClientsList[0].port,
					connected: true
				};
			} else if (minecraftClientsList.length > 0) {
				minecraftServerInfo = {
					address: minecraftClientsList[0].address,
					port: minecraftClientsList[0].port,
					connected: false
				};
			} else {
				minecraftServerInfo = { address: 'Unknown', port: 0, connected: false };
			}
		});

		socket.on('activity_history', (history) => {
			console.log('Received activity history:', history);
			activityStreamMessages = history.map((item: any) => ({
				...item,
				timestamp: new Date(item.timestamp)
			}));
		});

		socket.on('activity_update', (activity) => {
			console.log('Received activity update:', activity);
			activityStreamMessages = [
				{ ...activity, timestamp: new Date(activity.timestamp) },
				...activityStreamMessages
			];
			if (activityStreamMessages.length > 200) {
				activityStreamMessages = activityStreamMessages.slice(0, 200);
			}
		});
	});

	onDestroy(() => {
		if (socket) {
			socket.disconnect();
		}
	});

	function addSystemMessage(text: string) {
		dataMessages = [
			...dataMessages,
			{
				timestamp: new Date(),
				data: { system: true, message: text }
			}
		];
	}

	function formatTimestamp(date: Date): string {
		return date.toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatData(data: any): string {
		if (data.system) {
			return data.message;
		}

		try {
			return JSON.stringify(data, null, 2);
		} catch (e) {
			return String(data);
		}
	}

	function getMessageStyle(data: any): string {
		if (data.system) return 'bg-yellow-900/20 border-yellow-700/30';
		if (data.header && data.header.eventName === 'PlayerMessage')
			return 'bg-green-900/20 border-green-700/30';
		return 'bg-slate-800/50 border-slate-700/30';
	}

	function getStatusColor(status: string): { textColor: string; bgColor: string } {
		const lowerStatus = status.toLowerCase();
		switch (lowerStatus) {
			case 'connected':
				return { textColor: 'text-green-400', bgColor: 'bg-green-700/30' };
			case 'disconnected':
				return { textColor: 'text-red-400', bgColor: 'bg-red-700/30' };
			case 'connection error':
				return { textColor: 'text-yellow-400', bgColor: 'bg-yellow-700/30' };
			default:
				return { textColor: 'text-slate-400', bgColor: 'bg-slate-700/30' };
		}
	}

	function getPlayerStats(player: any) {
		if (!player.scores) return [];
		return Object.entries(player.scores).map(([key, value]) => ({ key, value }));
	}

	$: filteredSnapshots = selectedProject
		? Object.entries(worldDataSnapshots).filter(
				([key, snapshot]) => snapshot.from.projectName === selectedProject
			)
		: Object.entries(worldDataSnapshots);
</script>

<div class="min-h-screen bg-slate-900">
	<div class="mx-auto flex flex-col gap-8 p-12">
		<div>
			<h1 class="text-3xl font-bold text-white">Minecraft Bedrock WebSocket API</h1>
			<p class="text-sm text-slate-400">
				Demo for extracting data via the WebSocket API from Minecraft world data.
			</p>
		</div>

		<hr class="border-slate-700/30" />

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
			<div class="lg:col-span-1">
				<StatusCards {connectionStatus} {minecraftStatus} {getStatusColor} />
			</div>
			<ConnectionsPanel {formatTimestamp} {minecraftClientsList} {getStatusColor} />
			<InstructionsCard />
		</div>

		<WorldDataSnapshots
			{projects}
			bind:selectedProject
			{worldDataSnapshots}
			{filteredSnapshots}
			{formatTimestamp}
			{getPlayerStats}
			on:projectChange={(e) => (selectedProject = e.detail)}
		/>

		<RawDataMessages {dataMessages} {formatTimestamp} {formatData} {getMessageStyle} />
		<ActivityStream {activityStreamMessages} {formatTimestamp} />
	</div>
</div>
