<script lang="ts">
	import '@fontsource/roboto/100.css';
	import '@fontsource/roboto/300.css';
	import '@fontsource/josefin-sans/300.css';
	import MainContainer from '../components/MainContainer/MainContainer.svelte';
</script>

<MainContainer>
	<slot />
</MainContainer>

<style>
	:global(html) {
		--background: #282a36;
		--current-line: #44475a;
		--selection: #44475a;
		--foreground: #f8f8f2;
		--comment: #6272a4;
		--cyan: #8be9fd;
		--green: #50fa7b;
		--orange: #ffb86c;
		--pink: #ff79c6;
		--purple: #bd93f9;
		--red: #ff5555;
		--yellow: #f1fa8c;

		background: var(--background);
		color: var(--foreground);
		font-family: 'Roboto';
	}
	:global(body) {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
