import type WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { MinecraftClient, ActivityEvent } from './types.js';
import { logger } from './logger.js';

export class MinecraftManager {
	private clients = new Map<string, MinecraftClient>();
	private activityHistory: ActivityEvent[] = [];
	private onActivityCallback?: (activity: ActivityEvent) => void;
	private onClientUpdateCallback?: () => void;
	private onDataCallback?: (type: string, data: any, clientId: string) => void;

	constructor() {
	}

	setCallbacks(callbacks: {
		onActivity?: (activity: ActivityEvent) => void;
		onClientUpdate?: () => void;
		onData?: (type: string, data: any, clientId: string) => void;
	}) {
		this.onActivityCallback = callbacks.onActivity;
		this.onClientUpdateCallback = callbacks.onClientUpdate;
		this.onDataCallback = callbacks.onData;
	}

	addClient(id: string, socket: WebSocket, address: string, port: number): MinecraftClient {
		const client: MinecraftClient = {
			id,
			socket,
			address,
			port,
			connectTime: new Date(),
			lastActivity: new Date(),
			displayName: null,
			dataUpdateCount: 0,
			status: 'connected'
		};

		this.clients.set(id, client);
		this.addActivity(id, 'connection', {
			address,
			port,
			message: `Client connected from ${address}:${port}`
		});

		return client;
	}

	removeClient(id: string, immediate: boolean = false) {
		const client = this.clients.get(id);
		if (client) {
			client.status = 'disconnected';
			this.addActivity(id, 'disconnection', {
				message: `Client ${id} disconnected`,
				totalConnectionTime: Date.now() - client.connectTime.getTime()
			});

			if (immediate) {
				this.clients.delete(id);
			} else {
				setTimeout(() => {
					this.clients.delete(id);
					this.onClientUpdateCallback?.();
				}, 5000);
			}
		}
	}

	updateClientStatus(id: string, status: MinecraftClient['status']) {
		const client = this.clients.get(id);
		if (client) {
			client.status = status;
			this.onClientUpdateCallback?.();
		}
	}

	updateClientActivity(id: string, displayName?: string) {
		const client = this.clients.get(id);
		if (client) {
			client.lastActivity = new Date();
			client.dataUpdateCount++;
			if (displayName) {
				client.displayName = displayName;
			}
		}
	}

	sendToClient(clientId: string, message: string): boolean {
		const client = this.clients.get(clientId);
		if (client && client.socket.readyState === client.socket.OPEN) {
			client.socket.send(message);
			return true;
		}
		return false;
	}

	sendToAll(message: string): number {
		let sentCount = 0;
		this.clients.forEach((client) => {
			if (client.socket.readyState === client.socket.OPEN) {
				client.socket.send(message);
				sentCount++;
			}
		});
		return sentCount;
	}

	sendCommand(command: string, targetClientId?: string): boolean {
		const message = JSON.stringify({
			header: {
				version: 1,
				requestId: uuidv4(),
				messagePurpose: 'commandRequest',
				messageType: 'commandRequest'
			},
			body: {
				version: 1,
				commandLine: command,
				origin: { type: 'player' }
			}
		});

		if (targetClientId) {
			const success = this.sendToClient(targetClientId, message);
			if (success) {
				logger.log(`📤 Sent command to client ${targetClientId}: ${command}`);
			} else {
				logger.error(`❌ Failed to send to client ${targetClientId}: not found or disconnected`);
			}
			return success;
		} else {
			const sentCount = this.sendToAll(message);
			logger.log(`📤 Broadcast command to ${sentCount} clients: ${command}`);
			return sentCount > 0;
		}
	}

	getClients(): MinecraftClient[] {
		return Array.from(this.clients.values());
	}

	getClientList() {
		const clients = this.getClients().map((client) => ({
			id: client.id,
			address: client.address,
			port: client.port,
			connectTime: client.connectTime,
			lastActivity: client.lastActivity,
			displayName: client.displayName,
			dataUpdateCount: client.dataUpdateCount,
			status: client.status
		}));

		return {
			clients,
			totalConnected: clients.filter((c) => c.status === 'connected').length
		};
	}

	getActivityHistory(limit?: number): ActivityEvent[] {
		return limit ? this.activityHistory.slice(0, limit) : [...this.activityHistory];
	}

	private addActivity(
		clientId: string,
		type: ActivityEvent['type'],
		data: any,
		playerName?: string
	) {
		const activity: ActivityEvent = {
			id: uuidv4(),
			timestamp: new Date(),
			clientId,
			type,
			data,
			playerName
		};

		this.activityHistory.unshift(activity);
		this.onActivityCallback?.(activity);
		this.onClientUpdateCallback?.();
	}

	processMessage(clientId: string, message: any) {
		const client = this.clients.get(clientId);
		if (!client) return;

		// Update client activity
		const displayName =
			message.body?.sender || message.body?.properties?.Sender || message.body?.player?.name;
		this.updateClientActivity(clientId, displayName);

		// Extract world data snapshot
		const worldDataSnapshot = this.extractWorldDataSnapshot(message);
		const shouldRefresh = this.checkForGameEnd(message);

		// Handle game end refresh
		if (shouldRefresh) {
			logger.log(`🔄 Game ended detected for client ${clientId}, sending refresh command`);
			this.sendCommand('/scriptevent daigon:webhook_refresh', clientId);

			// Log the activity
			this.addActivity(clientId, 'data_update', {
				messageType: 'game_end_refresh',
				eventName: 'game_end_detected',
				message: 'Game ended - refresh command sent'
			});
		}

		if (worldDataSnapshot) {
			this.addActivity(clientId, 'world_snapshot', {
				projectName: worldDataSnapshot.from?.projectName,
				worldId: worldDataSnapshot.from?.worldId,
				playerCount: worldDataSnapshot.data?.length || 0,
				snapshot: worldDataSnapshot
			});

			this.onDataCallback?.(
				'world_data_snapshot',
				{
					data: worldDataSnapshot,
					clientId,
					timestamp: new Date().toISOString()
				},
				clientId
			);
		} else if (message.header?.eventName === 'PlayerMessage') {
			const sender = message.body?.properties?.Sender || message.body?.sender || client.displayName;
			if (sender) client.displayName = sender;

			this.addActivity(
				clientId,
				'player_message',
				{
					sender,
					message: message.body?.properties?.Message || message.body?.message || 'Unknown message',
					rawMessage: message
				},
				sender
			);

			this.onDataCallback?.(
				'minecraft_player_message',
				{
					data: message,
					clientId,
					playerName: sender,
					timestamp: new Date().toISOString()
				},
				clientId
			);
		} else {
			this.addActivity(clientId, 'data_update', {
				messageType: message.header?.messageType || 'unknown',
				eventName: message.header?.eventName || 'unknown',
				rawMessage: message
			});

			this.onDataCallback?.(
				'minecraft_generic_data',
				{
					data: message,
					clientId,
					timestamp: new Date().toISOString()
				},
				clientId
			);
		}
	}

	private checkForGameEnd(message: any): boolean {
		if (!message.body?.message) return false;

		try {
			const messageData = JSON.parse(message.body.message);
			if (messageData.rawtext && Array.isArray(messageData.rawtext)) {
				for (const part of messageData.rawtext) {
					if (part.text && typeof part.text === 'string') {
						if (part.text.includes('§cGame Ended!')) {
							return true;
						}
					}
				}
			}
		} catch (error) {
			// If parsing fails, also check raw message string
			if (
				typeof message.body.message === 'string' &&
				message.body.message.includes('§cGame Ended!')
			) {
				return true;
			}
		}

		return false;
	}

	private extractWorldDataSnapshot(message: any): any {
		if (!message.body?.message) return null;

		try {
			const messageData = JSON.parse(message.body.message);

			if (messageData.rawtext && Array.isArray(messageData.rawtext)) {
				let hasWorldDataHeader = false;
				let jsonDataText = '';

				for (const part of messageData.rawtext) {
					if (part.text && typeof part.text === 'string') {
						if (part.text.includes('World Data:')) {
							hasWorldDataHeader = true;
						} else if (hasWorldDataHeader) {
							jsonDataText = part.text;
							break;
						}
					}
				}

				if (hasWorldDataHeader && jsonDataText) {
					const parsedData = JSON.parse(jsonDataText);
					if (parsedData.from && parsedData.data) {
						return parsedData;
					}
				}
			}
		} catch (parseError) {
			if (
				typeof message.body.message === 'string' &&
				message.body.message.includes('World Data:')
			) {
				const jsonMatch = message.body.message.match(/World Data:[^{]*({.*})/s);
				if (jsonMatch && jsonMatch[1]) {
					try {
						const parsedData = JSON.parse(jsonMatch[1]);
						if (parsedData.from && parsedData.data) {
							return parsedData;
						}
					} catch (fallbackError) {
						logger.error('Failed to parse fallback WDS JSON:', fallbackError);
					}
				}
			}
		}

		return null;
	}
}
