<!-- @format -->
<script lang="ts">
  import { onMount } from "svelte";
  import ReplProxy from "./ReplProxy";
  import srcdoc from "./srcdoc/index.html?raw";
  import Bundler from "./Bundler";
  import { writable } from "svelte/store";
  import type { Writable } from "svelte/store";
  import type { Bundle, File } from "./types";
  import type { Handlers } from "./proxy";

  export let packagesUrl = "https://unpkg.com";
  export let svelteUrl = `${packagesUrl}/svelte`;

  export let relaxed = false;
  export let files: File[] = [];
  export let injectedJS = "";
  export let injectedCSS = "";
  export let theme: "light" | "dark" = "light";
  export let handlers: Handlers = {};
  export let disabled: boolean = true;

  $: disabled = error || pending || pending_imports || !ready;

  let bundle: Writable<Bundle | null> = writable(null);
  let iframe: HTMLIFrameElement;
  let proxy: ReplProxy | null = null;
  let ready = false;
  let initialized = false;
  let pending_imports = 0;
  let pending = false;
  let error: any;

  let bundler = new Bundler({
    packages_url: packagesUrl,
    svelte_url: svelteUrl,
    onstatus: (message) => {},
  });

  $: {
    if (files.length > 0)
      (async () => {
        $bundle = await bundler.bundle(files);
      })();
  }
  onMount(() => {
    proxy = new ReplProxy(iframe, {
      on_fetch_progress: (progress) => {
        pending_imports = progress;
        handlers.on_fetch_progress && handlers.on_fetch_progress(progress);
      },
      on_error: handlers.on_error,
      on_unhandled_rejection: (event) => {
        let error = event.value;
        if (typeof error === "string") error = { message: error };
        error.message = "Uncaught (in promise): " + error.message;
        handlers.on_unhandled_rejection &&
          handlers.on_unhandled_rejection(event);
      },
      on_console: handlers.on_console,
      on_console_group: handlers.on_console_group,
      on_console_group_end: handlers.on_console_group_end,
      on_console_group_collapsed: handlers.on_console_group_collapsed,
    });
    iframe.addEventListener("load", () => (ready = true));
    return () => {};
  });

  $: if (ready) proxy?.iframe_command("set_theme", { theme });

  async function apply_bundle($bundle: Bundle) {
    if (!$bundle || $bundle.error) return;
    try {
      await proxy?.eval(`
				${injectedJS}

				${styles}

				const styles = document.querySelectorAll('style[id^=svelte-]');

				let i = styles.length;
				while (i--) styles[i].parentNode.removeChild(styles[i]);

				if (window.component) {
					try {
						window.component.$destroy();
					} catch (err) {
						console.error(err);
					}
				}

				document.body.innerHTML = '';
				window.location.hash = '';
				window._svelteTransitionManager = null;

				${$bundle.dom?.code}

				window.component = new SvelteComponent.default({
					target: document.body
				});
			`);
      error = null;
    } catch {}
    initialized = true;
  }

  $: if (ready && $bundle) apply_bundle($bundle);

  $: styles =
    injectedCSS &&
    `{
		const style = document.createElement('style');
		style.textContent = ${JSON.stringify(injectedCSS)};
		document.head.appendChild(style);
	}`;
</script>

<iframe
  title="Result"
  class:initialized
  bind:this={iframe}
  sandbox={[
    "allow-popups-to-escape-sandbox",
    "allow-scripts",
    "allow-popups",
    "allow-forms",
    "allow-pointer-lock",
    "allow-top-navigation",
    "allow-modals",
    relaxed ? "allow-same-origin" : "",
  ].join(" ")}
  {srcdoc}
/>

<style>
  iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
</style>
