import type { ViteDevServer } from 'vite';
import { Server } from 'socket.io';
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

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

function warn(...args: any[]): void {
  console.warn(`${ANSI_BLACK}${formatLogTimestamp()}${ANSI_RESET} ${MIVUBI_LOG_PREFIX}`, ...args);
}

function info(...args: any[]): void {
  console.info(`${ANSI_BLACK}${formatLogTimestamp()}${ANSI_RESET} ${MIVUBI_LOG_PREFIX}`, ...args);
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

const minecraftClients = new Map<string, MinecraftClient>();

interface ActivityEvent {
  id: string;
  timestamp: Date;
  clientId: string;
  type: 'connection' | 'disconnection' | 'data_update' | 'player_message' | 'world_snapshot';
  data: any;
  playerName?: string;
}

let activityHistory: ActivityEvent[] = [];
const MAX_ACTIVITY_HISTORY = 500;

const minecraftWss = new WebSocketServer({ port: 8080 });

function addActivity(clientId: string, type: ActivityEvent['type'], data: any, playerName?: string) {
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

  if (global.io) {
    global.io.emit('activity_update', activity);
  }
}

function broadcastClientList() {
  if (global.io) {
    const clientList = Array.from(minecraftClients.values()).map(client => ({
      id: client.id,
      address: client.address,
      port: client.port,
      connectTime: client.connectTime,
      lastActivity: client.lastActivity,
      displayName: client.displayName,
      dataUpdateCount: client.dataUpdateCount,
      status: client.status
    }));

    global.io.emit('clients_update', {
      clients: clientList,
      totalConnected: clientList.filter(c => c.status === 'connected').length
    });
  }
}

function extractPlayerNamesFromSnapshot(data: any): string[] {
  const playerNames: string[] = [];
  if (data.data && Array.isArray(data.data)) {
    data.data.forEach((player: any) => {
      if (player.name) {
        playerNames.push(player.name);
      }
    });
  }
  return playerNames;
}

minecraftWss.on('connection', (socket, request) => {
  const clientId = uuidv4();
  const connectionInfo = request.socket.remoteAddress || 'Unknown';
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

  socket.send(JSON.stringify({
    "header": {
      "version": 1,
      "requestId": uuidv4(),
      "messageType": "commandRequest",
      "messagePurpose": "subscribe"
    },
    "body": {
      "eventName": "PlayerMessage"
    }
  }));

  socket.on('message', packet => {
    try {
      const msg = JSON.parse(packet.toString());
      log(`📨 From client ${clientId}:`, msg);
      client.displayName = msg.body?.sender ?? null;
      client.lastActivity = new Date();
      client.dataUpdateCount++;

      let worldDataSnapshot = null;

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
              try {
                const parsedData = JSON.parse(jsonDataText);
                if (parsedData.from && parsedData.data) {
                  worldDataSnapshot = parsedData;
                  log(`✅ Client ${clientId} sent World Data Snapshot:`, worldDataSnapshot);
                }
              } catch (parseError) {
                error(`❌ Client ${clientId} - Error parsing World Data Snapshot JSON:`, parseError);
              }
            }
          }
        } catch (parseError) {
          log(`Client ${clientId} - Message content is not valid JSON, checking other formats...`);

          if (msg.body.message.includes('World Data Snapshot')) {
            try {
              const jsonMatch = msg.body.message.match(/World Data Snapshot[^{]*({.*})/s);
              if (jsonMatch && jsonMatch[1]) {
                const parsedData = JSON.parse(jsonMatch[1]);
                if (parsedData.from && parsedData.data) {
                  worldDataSnapshot = parsedData;
                  log(`✅ Client ${clientId} sent World Data Snapshot (fallback):`, worldDataSnapshot);
                }
              }
            } catch (fallbackError) {
              error(`❌ Client ${clientId} - Fallback parsing also failed:`, fallbackError);
            }
          }
        }
      }

      if (!worldDataSnapshot && msg.body && msg.body.properties && msg.body.properties.Message) {
        try {
          const messageContent = msg.body.properties.Message;
          if (messageContent.includes('World Data Snapshot')) {
            const rawtextMatch = messageContent.match(/World Data Snapshot:\s*({.*})/s);
            if (rawtextMatch && rawtextMatch[1]) {
              worldDataSnapshot = JSON.parse(rawtextMatch[1]);
              log(`✅ Client ${clientId} sent World Data Snapshot (old format):`, worldDataSnapshot);
            }
          }
        } catch (parseError) {
          log(`Client ${clientId} - Old format parsing failed`);
        }
      }

      if (!worldDataSnapshot && msg.rawtext && Array.isArray(msg.rawtext)) {
        let hasWorldDataHeader = false;
        for (const part of msg.rawtext) {
          if (part.text && typeof part.text === 'string') {
            if (part.text.includes('World Data Snapshot')) {
              hasWorldDataHeader = true;
              continue;
            }

            if (hasWorldDataHeader) {
              try {
                const jsonData = JSON.parse(part.text);
                if (jsonData.from && jsonData.data) {
                  worldDataSnapshot = jsonData;
                  log(`✅ Client ${clientId} sent World Data Snapshot (direct rawtext):`, worldDataSnapshot);
                  break;
                }
              } catch (parseError) {
                
              }
            }
          }
        }
      }

      let activityType: ActivityEvent['type'] = 'data_update';
      let activityLogPlayerName: string | undefined = undefined;

      if (worldDataSnapshot) {
        activityType = 'world_snapshot';
        addActivity(clientId, activityType, {
          projectName: worldDataSnapshot.from?.projectName,
          worldId: worldDataSnapshot.from?.worldId,
          playerCount: worldDataSnapshot.data?.length || 0,
          snapshot: worldDataSnapshot
        });
      } else if (msg.header && msg.header.eventName === 'PlayerMessage') {
        activityType = 'player_message';
        let detectedSender: string | null = null;
        let activityLogPlayerName: string | undefined = undefined;

        if (msg.body?.properties?.Sender) {
          detectedSender = msg.body.properties.Sender;
          activityLogPlayerName = detectedSender ?? undefined;
        } else if (msg.body?.sender) {
          detectedSender = msg.body.sender;
          activityLogPlayerName = detectedSender ?? undefined;
        }

        if (msg.body?.receiver && typeof msg.body.receiver === 'string') {
          if (!activityLogPlayerName) {
            activityLogPlayerName = msg.body.receiver;
          }
        }

        const messageContent = msg.body?.properties?.Message || msg.body?.message;
        if (messageContent && typeof messageContent === 'string') {
          try {
            const messageData = JSON.parse(messageContent);
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
                const embeddedSnapshot = JSON.parse(jsonDataText);
                if (embeddedSnapshot.from && embeddedSnapshot.data) {
                  log(`📝 (Ignored for client.playerNames) Extracted player names from embedded snapshot.`);
                }
              }
            }
          } catch (e) {
          }
        }

        addActivity(clientId, activityType, {
          sender: detectedSender ?? undefined,
          message: msg.body?.properties?.Message || msg.body?.message || 'Unknown message',
          rawMessage: msg
        }, activityLogPlayerName);
      } else {
        addActivity(clientId, activityType, {
          messageType: msg.header?.messageType || 'unknown',
          eventName: msg.header?.eventName || 'unknown',
          rawMessage: msg
        });
      }

      broadcastClientList();

      if (global.io) {
        if (worldDataSnapshot) {
          log(`📤 Broadcasting World Data Snapshot from client ${clientId}`);
          global.io.emit('minecraft_data', {
            type: 'world_data_snapshot',
            data: worldDataSnapshot,
            clientId: clientId,
            timestamp: new Date().toISOString()
          });
        } else {
          global.io.emit('minecraft_data', {
            type: 'minecraft_data',
            data: msg,
            clientId: clientId,
            timestamp: new Date().toISOString()
          });
        }
      }

    } catch (error_outer) {
      error(`Error parsing message from client ${clientId}:`, error_outer);
      log('Raw message:', packet.toString());
    }
  });

  socket.on('close', () => {
    log(`❌ Minecraft client disconnected: ${clientId}`);

    client.status = 'disconnected';

    addActivity(clientId, 'disconnection', {
      message: `Client ${clientId} disconnected`,
      totalConnectionTime: Date.now() - client.connectTime.getTime()
    });

    setTimeout(() => {
      minecraftClients.delete(clientId);
      broadcastClientList();
    }, 5000);
    broadcastClientList();
  });

  socket.on('error', (socket_error) => {
    error(`Minecraft client ${clientId} socket error:`, socket_error);
    client.status = 'inactive';
    broadcastClientList();
  });
});

minecraftWss.on('error', (wss_error) => {
  error('Minecraft WebSocket server error:', wss_error);
});

log('Minecraft WebSocket Bridge running:');

declare global {
  var io: Server | null;
}

export const webSocketServer = {
  name: 'webSocketServer',
  configureServer(server: ViteDevServer) {
    if (!server.httpServer) return;

    const io = new Server(server.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    global.io = io;

    io.on('connection', (socket) => {
      log('🌐 Web client connected with ID:', socket.id);

      const clientList = Array.from(minecraftClients.values()).map(client => ({
        id: client.id,
        address: client.address,
        port: client.port,
        connectTime: client.connectTime,
        lastActivity: client.lastActivity,
        dataUpdateCount: client.dataUpdateCount,
        status: client.status
      }));

      socket.emit('clients_update', {
        clients: clientList,
        totalConnected: clientList.filter(c => c.status === 'connected').length
      });

      socket.emit('activity_history', activityHistory.slice(0, 50));
      socket.emit('minecraft_status', {
        type: 'minecraft_status',
        connected: clientList.some(c => c.status === 'connected'),
        serverInfo: clientList.length > 0 ? {
          address: clientList[0].address,
          port: clientList[0].port,
          connected: clientList.some(c => c.status === 'connected')
        } : { address: 'Unknown', port: 0, connected: false },
        message: clientList.length > 0
          ? `${clientList.filter(c => c.status === 'connected').length} Minecraft client(s) connected`
          : 'No Minecraft clients connected - use /connect localhost:8080 in game'
      });

      socket.on('disconnect', () => {
        log('🌐 Web client disconnected:', socket.id);
      });

      socket.on('error', (socket_io_error) => {
        error('Socket error:', socket_io_error);
      });
    });
  }
};