import type WebSocket from 'ws';

export interface MinecraftClient {
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

export interface ActivityEvent {
  id: string;
  timestamp: Date;
  clientId: string;
  type: 'connection' | 'disconnection' | 'data_update' | 'player_message' | 'world_snapshot';
  data: any;
  playerName?: string;
}

export interface Config {
  PORT: number;
  MINECRAFT_WS_PORT: number;
}