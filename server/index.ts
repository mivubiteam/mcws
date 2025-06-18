import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket as SocketIOSocket } from 'socket.io';
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { handler } from '../build/handler.js';

// Import our library modules
import { Config } from './lib/types.js';
import { logger } from './lib/logger.js';
import { MinecraftManager } from './lib/minecraft-manager.js';
import { getClientAddress, createSubscriptionMessage } from './lib/utils.js';

// Configuration
const config: Config = {
	PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
	MINECRAFT_WS_PORT: process.env.MINECRAFT_WS_PORT
		? parseInt(process.env.MINECRAFT_WS_PORT, 10)
		: 8080
};

// Store for PIN codes - maps PIN to client info
interface PinEntry {
	clientId: string;
	pin: string;
	uuid: string;
	createdAt: Date;
	isUsed: boolean;
}

const activePins = new Map<string, PinEntry>();

// Server setup
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
	cors: { origin: '*', methods: ['GET', 'POST'] }
});
const minecraftWss = new WebSocketServer({ port: config.MINECRAFT_WS_PORT });

// Initialize Minecraft Manager
const minecraftManager = new MinecraftManager();

// Set up callbacks
minecraftManager.setCallbacks({
	onActivity: (activity) => io.emit('activity_update', activity),
	onClientUpdate: () => io.emit('clients_update', minecraftManager.getClientList()),
	onData: (type, data) => io.emit('minecraft_data', { type, ...data })
});

// Minecraft WebSocket Server
minecraftWss.on('connection', (socket: WebSocket, request) => {
	const clientId = uuidv4();
	const address = getClientAddress(request);
	const port = request.socket.remotePort || 0;
	const sixDigitCode = Math.floor(100000 + Math.random() * 900000).toString();
	const uuid = uuidv4();

	const client = minecraftManager.addClient(clientId, socket, address, port);
	logger.log(`✅ Minecraft client connected: ${clientId} from ${address}:${port}`);

	// Store the PIN
	const pinEntry: PinEntry = {
		clientId,
		pin: sixDigitCode,
		uuid,
		createdAt: new Date(),
		isUsed: false
	};
	activePins.set(sixDigitCode, pinEntry);

	logger.log(`📌 Generated PIN ${sixDigitCode} for client ${clientId} with UUID ${uuid}`);

	// Send initial commands
	minecraftManager.sendCommand('/scriptevent daigon:webhook_connected', clientId);
	minecraftManager.sendCommand(`/scriptevent daigon:webhook_code ${sixDigitCode}`, clientId);
	socket.send(createSubscriptionMessage());

	socket.on('message', (packet: WebSocket.RawData) => {
		try {
			const message = JSON.parse(packet.toString());
			logger.log(`📨 From MC client ${clientId}:`, JSON.stringify(message, null, 2));
			minecraftManager.processMessage(clientId, message);
		} catch (error) {
			logger.error(`Error parsing message from MC client ${clientId}:`, error);
		}
	});

	socket.on('close', () => {
		logger.log(`❌ Minecraft client disconnected: ${clientId}`);
		activePins.delete(sixDigitCode);
		minecraftManager.removeClient(clientId);
	});

	socket.on('error', (err: Error) => {
		logger.error(`Minecraft client ${clientId} socket error:`, err);
		minecraftManager.updateClientStatus(clientId, 'inactive');
	});
});

minecraftWss.on('error', (err: Error) => {
	logger.error('Minecraft WebSocket server error:', err);
});

// Socket.IO Server (Web clients)
io.on('connection', (socket: SocketIOSocket) => {
	logger.log('🌐 Web client connected:', socket.id);

	const clientData = minecraftManager.getClientList();
	const connectedClients = clientData.clients.filter((c) => c.status === 'connected');

	// Send initial data
	socket.emit('clients_update', clientData);
	socket.emit('activity_history', minecraftManager.getActivityHistory(50));
	socket.emit('minecraft_status', {
		type: 'minecraft_status',
		connected: connectedClients.length > 0,
		serverInfo: connectedClients[0]
			? {
					address: connectedClients[0].address,
					port: connectedClients[0].port,
					connected: true
				}
			: {
					address: 'N/A',
					port: config.MINECRAFT_WS_PORT,
					connected: false
				},
		message:
			connectedClients.length > 0
				? `${connectedClients.length} Minecraft client(s) connected`
				: `No Minecraft clients connected - use /connect localhost:${config.MINECRAFT_WS_PORT} in game`
	});

	// Handle PIN validation from web clients
	socket.on('validate_pin', (data: { pin: string }) => {
		const pinEntry = activePins.get(data.pin);

		if (!pinEntry) {
			socket.emit('pin_validation_result', {
				success: false,
				message: 'Invalid PIN or PIN has expired'
			});
			return;
		}

		if (pinEntry.isUsed) {
			socket.emit('pin_validation_result', {
				success: false,
				message: 'PIN has already been used'
			});
			return;
		}

		// Mark PIN as used
		pinEntry.isUsed = true;

		// Send success message back to Minecraft
		const success = minecraftManager.sendCommand(
			`/scriptevent daigon:code_valid ${pinEntry.uuid}`,
			pinEntry.clientId
		);

		if (success) {
			logger.log(`✅ PIN ${data.pin} validated successfully for client ${pinEntry.clientId}`);
			socket.emit('pin_validation_result', {
				success: true,
				message: 'PIN accepted! Connection established.',
				clientId: pinEntry.clientId,
				uuid: pinEntry.uuid
			});

			// Optionally remove the PIN after successful use
			// activePins.delete(data.pin);
		} else {
			socket.emit('pin_validation_result', {
				success: false,
				message: 'Failed to communicate with Minecraft client'
			});
		}
	});

	// Handle commands from web clients
	socket.on('send_minecraft_command', (data: { command: string; targetClientId?: string }) => {
		const success = minecraftManager.sendCommand(data.command, data.targetClientId);
		socket.emit('command_result', {
			success,
			command: data.command,
			targetClientId: data.targetClientId
		});
	});

	socket.on('messageFromWebClient', (data: any) => {
		logger.log(`📨 Message from web client ${socket.id}:`, data);
	});

	socket.on('disconnect', () => {
		logger.log('🌐 Web client disconnected:', socket.id);
	});

	socket.on('error', (err: Error) => {
		logger.error('Socket.IO error for web client:', socket.id, err);
	});
});

// Express app
app.use(handler);

// Start server
httpServer.listen(config.PORT, () => {
	logger.log(`HTTP server listening on port ${config.PORT}`);
	logger.log(`Main application: http://localhost:${config.PORT}`);
	logger.log(`Minecraft clients connect to: ws://localhost:${config.MINECRAFT_WS_PORT}`);
});

logger.log(`Minecraft WebSocket Bridge running on port: ${config.MINECRAFT_WS_PORT}`);

// Graceful shutdown
const gracefulShutdown = () => {
	logger.log('Initiating graceful shutdown...');

	httpServer.close(() => {
		logger.log('HTTP server closed.');
		minecraftWss.close(() => {
			logger.log('Minecraft WebSocket server closed.');
			io.close(() => {
				logger.log('Socket.IO server closed.');
				process.exit(0);
			});
		});
	});

	setTimeout(() => {
		logger.error('Graceful shutdown timed out. Forcing exit.');
		process.exit(1);
	}, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
