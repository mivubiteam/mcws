<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount, onDestroy } from 'svelte';
	import io from 'socket.io-client';

	let pin: string = '';
	let pinDigits: string[] = Array(6).fill('');
	let isLoading: boolean = false;
	let error: string = '';
	let socket: any;
	let connectionStatus: string = 'Connecting...';
	let isSuccess: boolean = false;
	let successData: any = null;

	// Auto-focus the input when component mounts
	let pinInputs: HTMLInputElement[] = [];

	function handleInput(event: Event, index: number) {
		const target = event.target as HTMLInputElement;
		// Only allow numbers
		target.value = target.value.replace(/\D/g, '');
		pinDigits[index] = target.value;
		pin = pinDigits.join('');

		// Auto-advance to next input if a number was entered
		if (target.value && index < 5) {
			pinInputs[index + 1]?.focus();
		}

		// Clear any previous errors when user starts typing
		if (error) {
			error = '';
		}
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		// Handle backspace
		if (event.key === 'Backspace' && !pinDigits[index] && index > 0) {
			pinInputs[index - 1]?.focus();
		}

		// Allow: backspace, delete, tab, escape, enter
		if (
			[8, 9, 27, 13, 46].indexOf(event.keyCode) !== -1 ||
			// Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
			(event.keyCode === 65 && event.ctrlKey === true) ||
			(event.keyCode === 67 && event.ctrlKey === true) ||
			(event.keyCode === 86 && event.ctrlKey === true) ||
			(event.keyCode === 88 && event.ctrlKey === true)
		) {
			return;
		}
		// Ensure that it's a number and stop the keypress
		if (
			(event.shiftKey || event.keyCode < 48 || event.keyCode > 57) &&
			(event.keyCode < 96 || event.keyCode > 105)
		) {
			event.preventDefault();
		}
	}

	async function handleSubmit() {
		if (!pin || isLoading || pin.length < 6) {
			if (pin.length < 6) {
				error = 'PIN must be 6 digits';
			}
			return;
		}

		if (!socket || !socket.connected) {
			error = 'Connection to server lost. Please refresh the page.';
			return;
		}

		isLoading = true;
		error = '';

		try {
			// Send PIN validation request via Socket.IO
			socket.emit('validate_pin', { pin });
		} catch (err) {
			error = 'Connection error. Please try again.';
			isLoading = false;
		}
	}

	function handleRevalidate() {
		isSuccess = false;
		successData = null;
		pin = '';
		pinDigits = Array(6).fill('');
		error = '';

		// Auto-focus first input after revalidate
		setTimeout(() => pinInputs[0]?.focus(), 100);
	}

	// Initialize Socket.IO connection
	onMount(() => {
		console.log('Mounted');
		// Connect to the same host as the current page
		socket = io();

		socket.on('connect', () => {
			connectionStatus = 'Connected';
			console.log('Connected to server');
		});

		socket.on('disconnect', () => {
			connectionStatus = 'Disconnected';
			console.log('Disconnected from server');
		});

		socket.on('pin_validation_result', (result: any) => {
			isLoading = false;

			if (result.success) {
				// Success! Show success state
				isSuccess = true;
				successData = result;
				connectionStatus = `Connected to Minecraft (${result.uuid})`;
			} else {
				// Show error message
				error = result.message || 'Invalid PIN. Please try again.';
				// Re-focus first input after error
				setTimeout(() => pinInputs[0]?.focus(), 100);
			}
		});

		socket.on('connect_error', (err: any) => {
			connectionStatus = 'Connection Error';
			console.error('Socket.IO connection error:', err);
		});

		// Auto-focus first input on mount
		setTimeout(() => pinInputs[0]?.focus(), 100);
	});

	onDestroy(() => {
		if (socket) {
			socket.disconnect();
		}
	});
</script>

<div
	class="flex min-h-screen w-full items-center justify-center bg-gray-900 p-4 font-sans text-white"
>
	<!-- Main content card with entrance animation -->
	<div
		in:fly={{ y: 50, duration: 600, delay: 200, easing: quintOut }}
		class="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-800 p-8 shadow-lg"
	>
		{#if isSuccess}
			<!-- Success State -->
			<div class="flex flex-col gap-6 text-center">
				<!-- Success Icon -->
				<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
					<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"
						></path>
					</svg>
				</div>

				<!-- Success Message -->
				<div>
					<h1 class="mb-2 text-3xl font-bold text-green-400">Success!</h1>
					<p class="mb-1 text-gray-300">PIN accepted successfully</p>
				</div>

				<!-- Revalidate Button -->
				<button
					on:click={handleRevalidate}
					class="group relative flex items-center justify-center overflow-hidden rounded-xl bg-indigo-600 p-4 text-lg font-bold text-white transition-all duration-300 ease-out hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98]"
				>
					<span class="relative flex items-center justify-center">
						<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							></path>
						</svg>
						Enter New PIN
					</span>
				</button>

				<!-- Helper text -->
				<div class="text-center text-xs text-gray-400">
					<p>Click above to validate a new PIN</p>
				</div>
			</div>
		{:else}
			<!-- PIN Entry Form -->
			<form on:submit|preventDefault={handleSubmit} class="flex flex-col gap-6">
				<!-- Header -->
				<div class="text-center">
					<h1 class="text-3xl font-bold text-white">Game PIN</h1>
					<p class="mt-2 text-xs text-gray-400">Enter your 6 digit PIN to join the game</p>
				</div>

				<!-- PIN Input -->
				<div class="relative">
					<div class="grid grid-cols-6 gap-2">
						{#each Array(6) as _, i}
							<input
								bind:this={pinInputs[i]}
								type="text"
								bind:value={pinDigits[i]}
								on:input={(e) => handleInput(e, i)}
								on:keydown={(e) => handleKeydown(e, i)}
								maxlength="1"
								inputmode="numeric"
								disabled={isLoading || connectionStatus !== 'Connected'}
								class="aspect-square w-full rounded-xl border-2 bg-gray-700 text-center text-2xl font-bold text-white transition-all duration-300 placeholder:text-gray-400 focus:shadow-lg focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {pinDigits[
									i
								]
									? 'border-indigo-400 shadow-indigo-200/25'
									: 'border-gray-600'} {error
									? 'border-red-400 focus:border-red-400 focus:ring-red-200'
									: 'focus:border-indigo-500 focus:ring-indigo-200'}"
								autocomplete="off"
								spellcheck="false"
							/>
						{/each}
					</div>
				</div>

				<!-- Error message -->
				{#if error}
					<div
						class="rounded-lg border border-red-700 bg-red-900 p-3 text-center text-xs text-red-200"
					>
						{error}
					</div>
				{/if}

				<!-- Submit button -->
				<button
					type="submit"
					disabled={!pin || isLoading || pin.length < 6 || connectionStatus !== 'Connected'}
					class="group relative flex items-center justify-center overflow-hidden rounded-xl bg-indigo-600 p-4 text-lg font-bold text-white transition-all duration-300 ease-out hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
				>
					<!-- Button hover effect -->

					<span class="relative flex items-center justify-center">
						{#if isLoading}
							<svg
								class="h-6 w-6 animate-spin text-white"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							<span class="ml-2">Validating...</span>
						{:else}
							Enter Game
						{/if}
					</span>
				</button>
			</form>
		{/if}
	</div>
</div>
