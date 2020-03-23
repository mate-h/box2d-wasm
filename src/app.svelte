<script>
	import { onMount } from 'svelte';
	import { Game } from './game';

	let canvas;
	onMount(() => {
		const dppx = window.devicePixelRatio;
		const w = window.innerWidth;
		const h = window.innerHeight;
		canvas.style.width = w + "px";
		canvas.style.height = h + "px";
		canvas.width = w * dppx;
		canvas.height = h * dppx;

		Box2D().then(Box2D => {
			const game = new Game(Box2D);
			game.init(canvas);
		});
	});
</script>

<main>
	<canvas tabindex="-1" bind:this={canvas} />
</main>

<style>
	main {
		width: 100vw;
		height: 100vh;
	}
	canvas {
		box-sizing: border-box;
		width: 100vw;
		height: 100vh;
		transition: border-color 75ms linear;
		-webkit-transition: border-color 75ms linear;
		border: 1px solid #212121;
	}
	canvas:focus {
		border: 1px solid #607d8b;
	}
</style>