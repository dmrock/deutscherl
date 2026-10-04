<!--
  Word order with svelte-dnd-action (decision #11): the answer line and the word bank are two
  zones of the same type. Words move from the bank into the line, inside it and back. Mouse drags
  immediately; touch needs a long press (`delayTouchStart: 250`), so a swipe still scrolls; the
  keyboard uses the library's built-in support (Tab to a word, Space/Enter, arrows, Tab to the
  other zone). There is no single-tap alternative: WCAG 2.5.7 is a documented exception
  (owner decision #12).

  Parts are shown exactly as stored (neutral case); after checking, the sentence is shown with the
  first word capitalized and wrong positions marked.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { type DndEvent, dndzone, setAriaStrings } from 'svelte-dnd-action';
  import type { ExerciseStrings } from '../../lib/exercise-strings.ts';
  import {
    type Answer,
    type Chip,
    capitalizeFirst,
    checkWordOrder,
    format,
    formatSentence,
    type PreparedWordOrder,
    type WordOrderResult,
  } from '../../lib/exercises.ts';

  interface Props {
    item: PreparedWordOrder;
    strings: ExerciseStrings;
    onanswer: (answer: Answer) => void;
  }

  let { item, strings, onanswer }: Props = $props();

  // Raw state: the library replaces the arrays on every event and keeps item identities.
  let line = $state.raw<Chip[]>([]);
  // The runner re-creates this component for every item ({#key}), so the initial words are enough.
  // svelte-ignore state_referenced_locally
  let bank = $state.raw<Chip[]>(item.bank);
  let result = $state.raw<WordOrderResult>();
  let flipDurationMs = $state(150);

  const zone = $derived({
    type: `word-order-${item.id}`,
    flipDurationMs,
    delayTouchStart: 250,
    dropTargetStyle: {},
    dropTargetClasses: ['dnd-target'],
  });
  const answer = $derived([
    ...(item.lockedPart ? [item.lockedPart] : []),
    ...line.map((c) => c.text),
  ]);
  const shown = $derived(result ? capitalizeFirst(answer) : []);

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) flipDurationMs = 0;
    const message =
      (key: keyof ExerciseStrings) =>
      (ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) =>
        format(strings[key], {
          item: ctx.itemLabel,
          zone: ctx.zoneLabel,
          position: ctx.position,
          count: ctx.count,
        });
    // Global to the document; every zone on the page is in this locale.
    setAriaStrings({
      dragStarted: message('exercise.wordOrder.dragStarted'),
      movedToPosition: message('exercise.wordOrder.movedToPosition'),
      movedToZoneEnd: message('exercise.wordOrder.movedToZoneEnd'),
      movedToZoneStart: message('exercise.wordOrder.movedToZoneStart'),
      dropped: message('exercise.wordOrder.dropped'),
      zoneActiveInstruction: strings['exercise.wordOrder.instructions'],
      zoneDragDisabledInstruction: strings['exercise.wordOrder.disabled'],
    });
  });

  function onLine(event: CustomEvent<DndEvent<Chip>>) {
    line = event.detail.items;
  }

  function onBank(event: CustomEvent<DndEvent<Chip>>) {
    bank = event.detail.items;
  }

  function check() {
    result = checkWordOrder(item, answer);
    onanswer({
      correct: result.correct,
      region: undefined,
      solution: formatSentence(result.expected, item.punctuation),
    });
  }
</script>

<p class="text-muted">{strings['exercise.wordOrder.prompt']}</p>
{#if item.translation}
  <p class="mt-0.5">
    {format(strings['exercise.wordOrder.meaning'], { translation: item.translation })}
  </p>
{/if}

{#if result}
  <p class="mt-3 flex flex-wrap items-end gap-1.5" data-testid="word-order-result">
    {#each shown as word, index (index)}
      <span class={['chip chip-static', result.wrong[index] ? 'chip-wrong' : 'chip-right']}
        ><span lang="de">{word}</span>{#if result.wrong[index]}<span class="sr-only"
            >, {strings['exercise.wordOrder.wrongPosition']}</span
          >{/if}</span
      >
    {/each}
    <span lang="de" class="german">{item.punctuation}</span>
  </p>
{:else}
  <div class="mt-3 flex items-start gap-1.5 rounded-ui border border-control bg-card p-1.5">
    {#if item.lockedPart}
      <span class="chip chip-static chip-locked"
        ><span lang="de">{item.lockedPart}</span><span class="sr-only">
          ({strings['exercise.wordOrder.locked']})</span
        ></span
      >
    {/if}
    <div class="relative min-w-0 flex-1">
      {#if line.length === 0}
        <span
          class="pointer-events-none absolute inset-0 flex items-center px-1.5 text-sm text-muted"
          aria-hidden="true">{strings['exercise.wordOrder.dropHere']}</span
        >
      {/if}
      <div
        class="flex min-h-9 flex-wrap gap-1.5 rounded-chip"
        aria-label={strings['exercise.wordOrder.answer']}
        data-testid="answer-line"
        use:dndzone={{ ...zone, items: line }}
        onconsider={onLine}
        onfinalize={onLine}
      >
        {#each line as chip (chip.id)}
          <div
            class="chip"
            lang="de"
            aria-label={chip.text}
            animate:flip={{ duration: flipDurationMs }}
          >
            {chip.text}
          </div>
        {/each}
      </div>
    </div>
    <span lang="de" class="german self-center pe-1">{item.punctuation}</span>
  </div>

  <div
    class="mt-3 flex min-h-13 flex-wrap gap-1.5 rounded-ui bg-surface p-2"
    aria-label={strings['exercise.wordOrder.bank']}
    data-testid="word-bank"
    use:dndzone={{ ...zone, items: bank }}
    onconsider={onBank}
    onfinalize={onBank}
  >
    {#each bank as chip (chip.id)}
      <div
        class="chip"
        lang="de"
        aria-label={chip.text}
        animate:flip={{ duration: flipDurationMs }}
      >
        {chip.text}
      </div>
    {/each}
  </div>

  <button
    type="button"
    class="mt-3 inline-flex h-10 items-center rounded-ui bg-accent px-4 font-semibold text-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
    disabled={bank.length > 0}
    onclick={check}
  >
    {strings['exercise.check']}
  </button>
{/if}
