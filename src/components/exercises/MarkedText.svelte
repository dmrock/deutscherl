<!--
  Native-language text where `*word*` marks a German word (why texts): the island's copy of
  components/content/MarkedText.astro.
-->
<script lang="ts">
  import { splitMarked } from '../../lib/marked-text.ts';

  interface Props {
    text: string;
  }

  let { text }: Props = $props();
  const segments = $derived(splitMarked(text, '*'));
</script>

{#each segments as segment, index (index)}{#if segment.marked}<i lang="de">{segment.text}</i
    >{:else}{segment.text}{/if}{/each}
