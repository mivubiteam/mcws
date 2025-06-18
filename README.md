# Minecraft Bedrock WebSocket API Server

A Node.js/Bun + SvelteKit application for bridging Minecraft Bedrock Edition (or Education Edition) clients with a web dashboard via WebSocket and Socket.IO.

---

## Features

- **WebSocket server** for Minecraft Bedrock/Education clients
- **Web dashboard** (SvelteKit)
- **Activity stream** and **world data snapshots**
- **PIN-based authentication** for verifying Minecraft Map before playing
- **Socket.IO** for real-time web updates

---

## Project Structure

```
wsserver/
├── server/                # Node/Bun backend (WebSocket, Express, Socket.IO)
│   ├── index.ts           # Main server entry point
│   └── lib/               # Server-side utilities, types, logger, etc.
├── src/                   # SvelteKit frontend
│   ├── lib/components/    # Svelte UI components
│   └── routes/            # SvelteKit routes
├── static/                # Static assets (favicon, etc.)
├── build/                 # SvelteKit build output (after build)
```

---

## Getting Started

### 1. Install Dependencies

```bash
bun install
# or, if you use npm:
npm install
```

### 2. Development

The dev script will:
- Build the SvelteKit app (output to `build/`)
- Start the backend server (with auto-reload on changes)

```bash
bun run dev
```

- The web dashboard will be available at: [http://localhost:3000](http://localhost:3000)
- Minecraft clients connect to: `ws://localhost:8080`

### 3. Production

Build and start the server:

```bash
bun run build
bun run start
```

---

## Usage

### Minecraft Client

In Minecraft Bedrock or Education Edition, run:

```
/connect ws://<your-server-ip>:8080
```

- The server will generate a 6-digit PIN for the client.
- Enter this PIN on the web dashboard (or `/code` route) to link the client.

### Web Dashboard

- Visit [http://localhost:3000](http://localhost:3000) dashboard.
- See real-time activity, connected clients, world data, and raw messages.
- Use the PIN entry page [http://localhost:3000/code](http://localhost:3000/code) to link verify the map.

---

## How Minecraft Map Verification Works

This project uses a PIN-based verification system to ensure that only verified Minecraft maps can be played. The workflow is as follows:

### 1. Server Initialization

- The Minecraft world script initializes several managers (scoreboard, UI, world data, welcome).
- Scoreboard objectives are created for connection status, CTF stats, and the webhook code.

### 2. Connection Status & PIN Display

- Every 2 seconds, the script checks if the webhook (web dashboard) is connected.
- If **not connected**:
  - Players see a message prompting them to connect:  
    `§6Verification`  
    `Please run : §e/connect localhost:8080`
  - Players are teleported to a waiting area.
- If **connected but not yet verified**:
  - A 6-digit code is displayed to all players:  
    `§aCode: §6<code>`  
    `§7Open http://localhost:3000 to verify!`
- If **verified**:
  - Players can play the map as normal.
- If the game ends, all players are teleported to spawn and the state resets.

### 3. Script Events

The Minecraft script listens for custom events sent from the server:

- **daigon:webhook_connected**: Sets connection status to connected and notifies players.
- **daigon:webhook_refresh**: Triggers a world data post.
- **daigon:webhook_code**: Receives a new code from the server and displays it.
- **daigon:code_valid**: Marks the map as verified, unlocks gameplay, and teleports players to the start.

### 4. Web Dashboard Verification

- Players visit [http://localhost:3000/code](http://localhost:3000/code) and enter the displayed code.
- Upon successful verification, the map is unlocked and players can start the challenges.

#### Example In-Game Flow

1. Player joins the world and sees a prompt to connect.
2. Player runs `/connect ws://localhost:8080` in Minecraft.
3. A 6-digit code appears in-game.
4. Player enters the code at [http://localhost:3000/code](http://localhost:3000/code).
5. Upon success, the map is verified and gameplay begins.

---

## Scripts

| Script         | Description                                 |
|----------------|---------------------------------------------|
| `bun run dev`  | Build frontend and run backend in dev mode  |
| `bun run build`| Build the SvelteKit frontend                |
| `bun run start`| Build frontend and run backend in prod mode |

---

## Configuration

- Ports and other settings are set in `server/index.ts` (can be overridden by environment variables):
  - `PORT` (default: 3000) — web dashboard
  - `MINECRAFT_WS_PORT` (default: 8080) — Minecraft WebSocket

---

## Architecture

- **Backend**: Express + WebSocket + Socket.IO (Bun/Node)
- **Frontend**: SvelteKit (TailwindCSS)
---