<!--
  Exercise runner (CLAUDE.md, "UX rules"): rounds of 5 mixed items from the topic pool, progress
  dots, feedback with the `why` text and a "Report a mistake" link, a result screen and "Try again"
  (a new round with unseen items). Seen ids live in sessionStorage under `seen:<level>/<slug>`,
  shared between locales. All randomness goes through one seeded RNG; `?seed=<n>` fixes the seed
  in non-production builds (`allowSeed`), so e2e tests are deterministic.

  The server renders an empty placeholder: the round is picked in the browser.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { ExerciseStrings } from '../../lib/exercise-strings.ts';
  import {
    type Answer,
    createRng,
    createSeenStore,
    type Exercise,
    format,
    type PreparedExercise,
    parseSeed,
    pickRound,
    prepareExercise,
    type Rng,
    ROUND_COUNTS,
    reportMistakeUrl,
    type SeenStore,
  } from '../../lib/exercises.ts';
  import ChoiceExercise from './ChoiceExercise.svelte';
  import MarkedText from './MarkedText.svelte';
  import WordOrderExercise from './WordOrderExercise.svelte';

  interface Props {
    items: Exercise[];
    strings: ExerciseStrings;
    /** sessionStorage key for seen ids (`seen:<level>/<slug>`) */
    storageKey: string;
    locale: string;
    /** Canonical URL of the page, for the report link */
    pageUrl: string;
    repo: string;
    /** Honor `?seed=` (non-production builds only) */
    allowSeed: boolean;
  }

  let { items, strings, storageKey, locale, pageUrl, repo, allowSeed }: Props = $props();

  let phase = $state<'loading' | 'question' | 'result'>('loading');
  let round = $state.raw<PreparedExercise[]>([]);
  let roundNumber = $state(0);
  let index = $state(0);
  let results = $state.raw<boolean[]>([]);
  let feedback = $state.raw<Answer>();
  let progressEl = $state<HTMLElement>();
  let feedbackEl = $state<HTMLElement>();
  let resultEl = $state<HTMLElement>();

  let rng: Rng;
  let seen: SeenStore;

  const current = $derived(round[index]);
  const isLast = $derived(index === round.length - 1);
  const score = $derived(results.filter(Boolean).length);

  function randomSeed(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  }

  function startRound() {
    const picked = pickRound(items, seen.get(), ROUND_COUNTS, rng);
    seen.set(picked.seen);
    round = picked.items.map((item) => prepareExercise(item, rng));
    roundNumber++;
    index = 0;
    results = [];
    feedback = undefined;
    phase = 'question';
  }

  onMount(() => {
    const requested = allowSeed
      ? parseSeed(new URLSearchParams(location.search).get('seed'))
      : undefined;
    rng = createRng(requested ?? randomSeed());
    seen = createSeenStore(storageKey, () => window.sessionStorage);
    startRound();
  });

  async function onanswer(answer: Answer) {
    feedback = answer;
    results = [...results, answer.correct];
    await tick();
    feedbackEl?.focus();
  }

  async function next() {
    if (isLast) {
      phase = 'result';
      await tick();
      resultEl?.focus();
      return;
    }
    index++;
    feedback = undefined;
    await tick();
    progressEl?.focus();
  }

  async function tryAgain() {
    startRound();
    await tick();
    progressEl?.focus();
  }

  function dotClass(position: number): string {
    const answered = results[position];
    if (answered !== undefined) return answered ? 'bg-success' : 'bg-danger';
    if (position === index)
      return 'bg-accent ring-2 ring-accent-soft ring-offset-1 ring-offset-card';
    return 'bg-border';
  }
</script>

<!-- Before hydration: reserve about the height of a question, so the page does not jump. -->
<div class={phase === 'loading' ? 'min-h-64' : undefined} data-phase={phase}>
  {#if phase === 'question' && current}
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-muted" tabindex="-1" bind:this={progressEl}>
        {format(strings['exercise.progress'], { current: index + 1, total: round.length })}
      </p>
      <ol class="flex gap-1.5" aria-hidden="true">
        {#each round as item, position (item.id)}
          <li class={['size-2.5 rounded-full', dotClass(position)]}></li>
        {/each}
      </ol>
    </div>

    <div class="mt-2" data-item-id={current.id} data-kind={current.kind}>
      {#key `${roundNumber}:${current.id}`}
        {#if current.kind === 'choice'}
          <ChoiceExercise item={current} {strings} {locale} {onanswer} />
        {:else}
          <WordOrderExercise item={current} {strings} {onanswer} />
        {/if}
      {/key}
    </div>

    {#if feedback}
      <div
        class={[
          'mt-3 rounded-ui border px-3 py-2',
          feedback.correct ? 'border-success bg-success-soft' : 'border-danger bg-danger-soft',
        ]}
        tabindex="-1"
        data-testid="feedback"
        bind:this={feedbackEl}
      >
        <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class={['font-semibold', feedback.correct ? 'text-success' : 'text-danger']}>
            {feedback.correct ? strings['exercise.correct'] : strings['exercise.incorrect']}
          </span>
          {#if feedback.region === 'AT'}
            <span class="inline-flex items-center gap-1.5 text-sm">
              <span class="flag" aria-hidden="true"></span>
              {strings['topic.austrianUsage']}
            </span>
          {/if}
        </p>
        {#if !feedback.correct}
          <p class="mt-1">
            {strings['exercise.correctAnswer']}
            <span lang="de" class="german font-semibold">{feedback.solution}</span>
          </p>
        {/if}
        {#if current.why}
          <p class="mt-1"><MarkedText text={current.why} /></p>
        {/if}
        <p class="mt-1.5 text-sm">
          <a
            href={reportMistakeUrl({ repo, pageUrl, locale, itemId: current.id })}
            target="_blank"
            rel="noopener"
            class="text-muted underline underline-offset-2 hover:text-accent"
          >
            {strings['exercise.reportMistake']}
          </a>
        </p>
      </div>
      <button
        type="button"
        class="mt-3 inline-flex h-10 items-center rounded-ui bg-accent px-4 font-semibold text-accent-fg"
        onclick={next}
      >
        {isLast ? strings['exercise.showResult'] : strings['exercise.next']}
      </button>
    {/if}
  {:else if phase === 'result'}
    <h3 class="text-lg" tabindex="-1" bind:this={resultEl}>{strings['exercise.resultTitle']}</h3>
    <p class="mt-1" data-testid="score">
      {format(strings['exercise.result'], { correct: score, total: round.length })}
    </p>
    <ol class="mt-2 flex gap-1.5" aria-hidden="true">
      {#each results as correct, position (position)}
        <li class={['size-2.5 rounded-full', correct ? 'bg-success' : 'bg-danger']}></li>
      {/each}
    </ol>
    <button
      type="button"
      class="mt-3 inline-flex h-10 items-center rounded-ui bg-accent px-4 font-semibold text-accent-fg"
      onclick={tryAgain}
    >
      {strings['exercise.tryAgain']}
    </button>
  {/if}
</div>
