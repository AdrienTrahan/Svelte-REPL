<script lang="ts">
  import Viewer from "$lib/Viewer/Viewer.svelte";
  let disabled: boolean;
  let myText: string = "Modify this text";
  $: files = [
    {
      name: "App",
      type: "svelte",
      source:
        "<scri" +
        'pt>import MyComponent from "./MyComponent.svelte"</sc' +
        "ript><MyComponent />",
    },
    {
      name: "MyComponent",
      type: "svelte",
      source:
        "<scri" +
        "pt></sc" +
        `ript><h1>This is my component</h1><p> this updates in realtime! ${myText}</p>`,
    },
  ];
</script>

<Viewer {files} bind:disabled></Viewer>

<input type="text" bind:value={myText} />
