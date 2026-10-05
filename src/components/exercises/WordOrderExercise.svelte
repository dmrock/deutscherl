<!--
  Word order with svelte-dnd-action (decision #11): the answer line and the word bank are two
  zones of the same type. Words move from the bank into the line, inside it and back. Mouse drags
  immediately; touch needs a long press (`delayTouchStart: 250`), so a swipe still scrolls.

  Tap or click a word to move it without dragging (owner decision #76, the single-pointer
  alternative of WCAG 2.5.7): from the bank to the end of the line, from the line back to the bank.
  Enter does the same from the keyboard; Space picks a word up for the library's keyboard dragging
  (arrows, Tab to the other zone).

  Only trusted clicks count: after a touch tap the library also dispatches a synthetic click, and
  the browser's own click follows, so handling both would move two words. The listener is attached
  to each word directly (not Svelte's delegated `onclick`), because iOS Safari may not deliver
  delegated clicks on plain elements.

  Parts are shown exactly as stored (neutral case); after checking, the sentence is shown with the
  first word capitalized and wrong positions marked.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import type { Attachment } from 'svelte/attachments';
  import {
    alertToScreenReader,
    type DndEvent,
    dndzone,
    setAriaStrings,
    setKeyboardDragTrigger,
  } from 'svelte-dnd-action';
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
  let lineEl = $state<HTMLElement>();
  let bankEl = $state<HTMLElement>();
  let checkEl = $state<HTMLButtonElement>();

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
    // Global to the document; every zone on the page is in this locale. Enter is ours (move the
    // word), so only Space starts the library's keyboard drag.
    setKeyboardDragTrigger('space');
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

  type Zone = 'line' | 'bank';

  /** Moves a word to the end of the other zone (tap, click or Enter). */
  async function move(chip: Chip, from: Zone, byKeyboard: boolean) {
    if (result) return;
    const source = from === 'bank' ? bank : line;
    const index = source.findIndex((entry) => entry.id === chip.id);
    if (index === -1) return;
    const rest = source.filter((entry) => entry.id !== chip.id);
    if (from === 'bank') {
      bank = rest;
      line = [...line, chip];
    } else {
      line = rest;
      bank = [...bank, chip];
    }
    if (!byKeyboard) return;
    alertToScreenReader(
      format(strings['exercise.wordOrder.movedToZoneEnd'], {
        item: chip.text,
        zone: strings[from === 'bank' ? 'exercise.wordOrder.answer' : 'exercise.wordOrder.bank'],
      }),
    );
    // Keep the keyboard in the same zone: the word now at the same place, else the last one;
    // when the bank is empty, the Check button.
    await tick();
    const zoneEl = from === 'bank' ? bankEl : lineEl;
    const words = [...(zoneEl?.querySelectorAll<HTMLElement>('.chip') ?? [])];
    const target = words[Math.min(index, words.length - 1)];
    if (target) target.focus();
    else if (from === 'bank') checkEl?.focus();
    else bankEl?.querySelector<HTMLElement>('.chip:last-child')?.focus();
  }

  function tapToMove(chip: Chip, from: Zone): Attachment<HTMLElement> {
    return (node) => {
      const onClick = (event: MouseEvent) => {
        if (event.isTrusted) move(chip, from, false);
      };
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        move(chip, from, true);
      };
      node.addEventListener('click', onClick);
      node.addEventListener('keydown', onKey);
      return () => {
        node.removeEventListener('click', onClick);
        node.removeEventListener('keydown', onKey);
      };
    };
  }

  function check() {
    result = checkWordOrder(item, answer);
    onanswer({
      correct: result.correct,
      region: undefined,
      given: formatSentence(answer, item.punctuation),
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
        bind:this={lineEl}
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
            {@attach tapToMove(chip, 'line')}
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
    bind:this={bankEl}
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
        {@attach tapToMove(chip, 'bank')}
      >
        {chip.text}
      </div>
    {/each}
  </div>

  <button
    type="button"
    class="mt-3 inline-flex h-10 items-center rounded-ui bg-accent px-4 font-semibold text-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
    disabled={bank.length > 0}
    bind:this={checkEl}
    onclick={check}
  >
    {strings['exercise.check']}
  </button>
{/if}
