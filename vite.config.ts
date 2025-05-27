import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { webSocketServer } from './src/lib/websocket-server';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), webSocketServer]
});