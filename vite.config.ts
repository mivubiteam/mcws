import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
// import { webSocketServer } from './src/lib/websocket-server'; // Removed

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()]
});