import express from 'express';
import { createServer, IncomingMessage } from 'http';
import { Server as SocketIOServer, Socket as SocketIOSocket } from 'socket.io';
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { handler } from '../build/handler.js';

function formatLogTimestamp(): string {
	const now = new Date();
	const hours = now.getHours().toString().padStart(2, '0');
	const minutes = now.getMinutes().toString().padStart(2, '0');
	const seconds = now.getSeconds().toString().padStart(2, '0');
	return `${hours}.${minutes}.${seconds}`;
}

const MIVUBI_LOG_PREFIX_TEXT = '[mivubi]';
const ANSI_BRIGHT_GREEN = '\x1b[92m';
const ANSI_RESET = '\x1b[0m';
const ANSI_BLACK = '\x1b[30m';

const MIVUBI_LOG_PREFIX = `${ANSI_BRIGHT_GREEN}${MIVUBI_LOG_PREFIX_TEXT}${ANSI_RESET}`;

function log(...args: any[]): void {
	console.log(`${ANSI_BLACK}${formatLogTimestamp()}${ANSI_RESET} ${MIVUBI_LOG_PREFIX}`, ...args);
}

function error(...args: any[]): void {
	console.error(`${ANSI_BLACK}${formatLogTimestamp()}${ANSI_RESET} ${MIVUBI_LOG_PREFIX}`, ...args);
}

interface MinecraftClient {
	id: string;
	socket: WebSocket;
	address: string;
	port: number;
	connectTime: Date;
	lastActivity: Date;
	displayName: string | null;
	dataUpdateCount: number;
	status: 'connected' | 'inactive' | 'disconnected';
}

interface ActivityEvent {
	id: string;
	timestamp: Date;
	clientId: string;
	type: 'connection' | 'disconnection' | 'data_update' | 'player_message' | 'world_snapshot';
	data: any;
	playerName?: string;
}

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const minecraftWsPort = process.env.MINECRAFT_WS_PORT
	? parseInt(process.env.MINECRAFT_WS_PORT, 10)
	: 8080;

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST']
	}
});

const minecraftWss = new WebSocketServer({ port: minecraftWsPort });

log('Express server created. Socket.IO and Minecraft WebSocket servers are being set up.');

const minecraftClients = new Map<string, MinecraftClient>();
let activityHistory: ActivityEvent[] = [];
const MAX_ACTIVITY_HISTORY = 500;

function addActivity(
	clientId: string,
	type: ActivityEvent['type'],
	data: any,
	playerName?: string
): void {
	const activity: ActivityEvent = {
		id: uuidv4(),
		timestamp: new Date(),
		clientId,
		type,
		data,
		playerName
	};

	activityHistory.unshift(activity);
	if (activityHistory.length > MAX_ACTIVITY_HISTORY) {
		activityHistory = activityHistory.slice(0, MAX_ACTIVITY_HISTORY);
	}
	io.emit('activity_update', activity);
}

function broadcastClientList(): void {
	const clientList = Array.from(minecraftClients.values()).map((client) => ({
		id: client.id,
		address: client.address,
		port: client.port,
		connectTime: client.connectTime,
		lastActivity: client.lastActivity,
		displayName: client.displayName,
		dataUpdateCount: client.dataUpdateCount,
		status: client.status
	}));

	io.emit('clients_update', {
		clients: clientList,
		totalConnected: clientList.filter((c) => c.status === 'connected').length
	});
}

minecraftWss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
	const clientId = uuidv4();

	log('[MC Connection Debug] Request Headers:', request.headers);
	log('[MC Connection Debug] Request Socket Details:', {
		remoteAddress: request.socket?.remoteAddress,
		remotePort: request.socket?.remotePort,
		address:
			typeof request.socket?.address === 'function'
				? request.socket?.address()
				: JSON.stringify(request.socket?.address),
		localAddress: request.socket?.localAddress,
		localPort: request.socket?.localPort,
		readyState: request.socket?.readyState,
		destroyed: request.socket?.destroyed
	});

	let connectionInfo = request.socket.remoteAddress;
	if (!connectionInfo) {
		const xForwardedFor = request.headers['x-forwarded-for'];
		if (xForwardedFor) {
			if (Array.isArray(xForwardedFor)) {
				connectionInfo = xForwardedFor[0];
			} else {
				connectionInfo = xForwardedFor.split(',')[0].trim();
			}
			log(`[MC Connection Debug] Used X-Forwarded-For: ${connectionInfo}`);
		} else {
			connectionInfo = '127.0.0.1';
			log(
				`[MC Connection Debug] No remoteAddress or X-Forwarded-For. Defaulting to: ${connectionInfo}`
			);
		}
	}
	const connectionPort = request.socket.remotePort || 0;

	const client: MinecraftClient = {
		id: clientId,
		socket,
		address: connectionInfo,
		port: connectionPort,
		connectTime: new Date(),
		lastActivity: new Date(),
		displayName: null,
		dataUpdateCount: 0,
		status: 'connected'
	};

	minecraftClients.set(clientId, client);
	log(`✅ Minecraft client connected: ${clientId} from ${connectionInfo}:${connectionPort}`);
	addActivity(clientId, 'connection', {
		address: connectionInfo,
		port: connectionPort,
		message: `Client connected from ${connectionInfo}:${connectionPort}`
	});
	broadcastClientList();

	socket.send(
		JSON.stringify({
			header: {
				version: 1,
				requestId: uuidv4(),
				messageType: 'commandRequest',
				messagePurpose: 'subscribe'
			},
			body: {
				eventName: 'PlayerMessage'
			}
		})
	);

	socket.on('message', (packet: WebSocket.RawData) => {
		try {
			const msg = JSON.parse(packet.toString());
			log(`📨 From MC client ${clientId}:`, JSON.stringify(msg, null, 2));
			client.lastActivity = new Date();
			client.dataUpdateCount++;

			client.displayName =
				msg.body?.sender ??
				msg.body?.properties?.Sender ??
				msg.body?.player?.name ??
				client.displayName;

			let worldDataSnapshot: any = null;

			if (msg.body && msg.body.message) {
				try {
					const messageData = JSON.parse(msg.body.message);
					if (messageData.rawtext && Array.isArray(messageData.rawtext)) {
						let hasWorldDataHeader = false;
						let jsonDataText = '';
						for (const part of messageData.rawtext) {
							if (part.text && typeof part.text === 'string') {
								if (part.text.includes('World Data Snapshot')) {
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
								worldDataSnapshot = parsedData;
								log(`✅ Client ${clientId} sent World Data Snapshot (rawtext):`, worldDataSnapshot);
							}
						}
					}
				} catch (parseError) {
					log(
						`Client ${clientId} - Primary WDS extraction from rawtext failed. Message:`,
						msg.body.message
					);
					if (
						typeof msg.body.message === 'string' &&
						msg.body.message.includes('World Data Snapshot')
					) {
						const jsonMatch = msg.body.message.match(/World Data Snapshot[^{]*({.*})/s);
						if (jsonMatch && jsonMatch[1]) {
							try {
								const parsedData = JSON.parse(jsonMatch[1]);
								if (parsedData.from && parsedData.data) {
									worldDataSnapshot = parsedData;
									log(
										`✅ Client ${clientId} sent World Data Snapshot (fallback regex):`,
										worldDataSnapshot
									);
								}
							} catch (fallbackParseError) {
								error(
									`❌ Client ${clientId} - Error parsing fallback WDS JSON:`,
									fallbackParseError
								);
							}
						}
					}
				}
			}

			let activityType: ActivityEvent['type'] = 'data_update';
			const activityLogPlayerName: string | undefined = client.displayName ?? undefined;

			if (worldDataSnapshot) {
				activityType = 'world_snapshot';
				addActivity(clientId, activityType, {
					projectName: worldDataSnapshot.from?.projectName,
					worldId: worldDataSnapshot.from?.worldId,
					playerCount: worldDataSnapshot.data?.length || 0,
					snapshot: worldDataSnapshot
				});
				io.emit('minecraft_data', {
					type: 'world_data_snapshot',
					data: worldDataSnapshot,
					clientId: clientId,
					timestamp: new Date().toISOString()
				});
			} else if (msg.header && msg.header.eventName === 'PlayerMessage') {
				activityType = 'player_message';
				const sender = msg.body?.properties?.Sender || msg.body?.sender || client.displayName;
				if (sender) client.displayName = sender;

				addActivity(
					clientId,
					activityType,
					{
						sender: sender,
						message: msg.body?.properties?.Message || msg.body?.message || 'Unknown message',
						rawMessage: msg
					},
					sender ?? undefined
				);
				io.emit('minecraft_data', {
					type: 'minecraft_player_message',
					data: msg,
					clientId: clientId,
					playerName: sender,
					timestamp: new Date().toISOString()
				});
			} else {
				addActivity(clientId, activityType, {
					messageType: msg.header?.messageType || 'unknown',
					eventName: msg.header?.eventName || 'unknown',
					rawMessage: msg
				});
				io.emit('minecraft_data', {
					type: 'minecraft_generic_data',
					data: msg,
					clientId: clientId,
					timestamp: new Date().toISOString()
				});
			}
			broadcastClientList();
		} catch (e_outer) {
			error(
				`Error parsing message from MC client ${clientId}:`,
				e_outer,
				'\nRaw message:',
				packet.toString()
			);
		}
	});

	socket.on('close', () => {
		log(`❌ Minecraft client disconnected: ${clientId}`);
		const mcClient = minecraftClients.get(clientId);
		if (mcClient) {
			mcClient.status = 'disconnected';
			addActivity(clientId, 'disconnection', {
				message: `Client ${clientId} disconnected`,
				totalConnectionTime: Date.now() - mcClient.connectTime.getTime()
			});

			setTimeout(() => {
				minecraftClients.delete(clientId);
				broadcastClientList();
			}, 5000);
			broadcastClientList();
		}
	});

	socket.on('error', (err: Error) => {
		error(`Minecraft client ${clientId} socket error:`, err);
		const mcClient = minecraftClients.get(clientId);
		if (mcClient) {
			mcClient.status = 'inactive';
			broadcastClientList();
		}
	});
});

minecraftWss.on('error', (err: Error) => {
	error('Minecraft WebSocket server (minecraftWss) error:', err);
});

log(`Minecraft WebSocket Bridge (minecraftWss) running on port: ${minecraftWsPort}`);

io.on('connection', (socket: SocketIOSocket) => {
	log('🌐 Web client connected with ID:', socket.id);

	const clientList = Array.from(minecraftClients.values()).map((c) => ({
		id: c.id,
		address: c.address,
		port: c.port,
		connectTime: c.connectTime,
		lastActivity: c.lastActivity,
		displayName: c.displayName,
		dataUpdateCount: c.dataUpdateCount,
		status: c.status
	}));

	socket.emit('clients_update', {
		clients: clientList,
		totalConnected: clientList.filter((c) => c.status === 'connected').length
	});
	socket.emit('activity_history', activityHistory.slice(0, 50));

	const anyMinecraftClientConnected = clientList.some((c) => c.status === 'connected');
	const firstConnectedClient = clientList.find((c) => c.status === 'connected');

	socket.emit('minecraft_status', {
		type: 'minecraft_status',
		connected: anyMinecraftClientConnected,
		serverInfo: firstConnectedClient
			? {
					address: firstConnectedClient.address,
					port: firstConnectedClient.port,
					connected: true
				}
			: { address: 'N/A', port: minecraftWsPort, connected: false },
		message: anyMinecraftClientConnected
			? `${clientList.filter((c) => c.status === 'connected').length} Minecraft client(s) connected`
			: `No Minecraft clients connected - use /connect localhost:${minecraftWsPort} in game`
	});

	socket.on('disconnect', () => {
		log('🌐 Web client disconnected:', socket.id);
	});

	socket.on('error', (err: Error) => {
		error('Socket.IO (web client) error for ID %s:', socket.id, err);
	});

	socket.on('messageFromWebClient', (data: any) => {
		log(`📨 Message from web client ${socket.id}:`, data);
	});
});

log('Socket.IO server (for web clients) initialized and listening for connections.');

app.use(handler);

httpServer.listen(port, () => {
	log(`🚀 HTTP server listening on port ${port}. SvelteKit app is served here.`);
	log(`🔗 Main application: http://localhost:${port}`);
	log(`🔌 Minecraft clients connect to: ws://localhost:${minecraftWsPort}`);
});

function gracefulShutdown() {
	log('Initiating graceful shutdown...');
	httpServer.close(() => {
		log('HTTP server closed.');
		minecraftWss.close(() => {
			log('Minecraft WebSocket server closed.');
			io.close(() => {
				log('Socket.IO server closed.');
				process.exit(0);
			});
		});
	});

	setTimeout(() => {
		error('Graceful shutdown timed out. Forcing exit.');
		process.exit(1);
	}, 10000);
}

process.on('SIGTERM', () => {
	log('SIGTERM signal received.');
	gracefulShutdown();
});
process.on('SIGINT', () => {
	log('SIGINT signal received.');
	gracefulShutdown();
});
