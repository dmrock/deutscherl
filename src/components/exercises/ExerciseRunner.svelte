<!--
  Exercise runner (CLAUDE.md, "UX rules"): rounds of 5 mixed items from the topic pool, progress
  dots, feedback with the `why` text and a "Report a mistake" link, a result screen and "Try again"
  (a new round with unseen items). Seen ids live in sessionStorage under `seen:<level>/<slug>`,
  shared between locales. All randomness goes through one seeded RNG; `?seed=<n>` fixes the seed
  in non-production builds (`allowSeed`), so e2e tests are deterministic.

  The server renders the "Start practice" button (disabled until hydrated); the round is picked
  when it is pressed, so the first paint never changes.

  No jumps (the page must not move under the learner, decision #74): "Start" marks the practice
  section active, which makes it fill the screen below the header (global.css), and scrolls it to
  the top once. Questions and feedback then grow inside that space. On screens too small for a
  question with its feedback, the box only grows (min-height = tallest content so far, reset when
  its width changes) and the page scrolls smoothly only when the feedback or the next question is
  out of view. Focus always moves without the browser's instant scroll.
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

  let phase = $state<'intro' | 'question' | 'result'>('intro');
  let ready = $state(false);
  let round = $state.raw<PreparedExercise[]>([]);
  let roundNumber = $state(0);
  let index = $state(0);
  /** Answers of this round, in order (the result screen lists them) */
  let answers = $state.raw<Answer[]>([]);
  let feedback = $state.raw<Answer>();
  let progressEl = $state<HTMLElement>();
  let feedbackEl = $state<HTMLElement>();
  let resultEl = $state<HTMLElement>();
  let afterAnswerEl = $state<HTMLElement>();
  let rootEl = $state<HTMLElement>();
  let contentEl = $state<HTMLElement>();
  let minHeight = $state(0);
  let tooltipDismissed = $state(false);

  let rng: Rng;
  let seen: SeenStore;

  const current = $derived(round[index]);
  const isLast = $derived(index === round.length - 1);
  const score = $derived(answers.filter((answer) => answer.correct).length);

  function randomSeed(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  }

  function startRound() {
    const picked = pickRound(items, seen.get(), ROUND_COUNTS, rng);
    seen.set(picked.seen);
    round = picked.items.map((item) => prepareExercise(item, rng));
    roundNumber++;
    index = 0;
    answers = [];
    feedback = undefined;
    phase = 'question';
  }

  onMount(() => {
    const requested = allowSeed
      ? parseSeed(new URLSearchParams(location.search).get('seed'))
      : undefined;
    rng = createRng(requested ?? randomSeed());
    seen = createSeenStore(storageKey, () => window.sessionStorage);
    ready = true;

    let width = -1;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const size = entry.contentRect;
      minHeight = size.width === width ? Math.max(minHeight, size.height) : size.height;
      width = size.width;
    });
    if (contentEl) observer.observe(contentEl);
    return () => observer.disconnect();
  });

  function scrollBehavior(): ScrollBehavior {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  /** Moves focus without the browser's instant scroll; scrolls smoothly only if `target` is out of view. */
  function moveFocus(element: HTMLElement | undefined, target = element) {
    element?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
  }

  /** "Start practice": the section takes the whole screen and moves to the top, once. */
  async function start() {
    const section = rootEl?.closest('section');
    section?.setAttribute('data-practice-active', '');
    startRound();
    await tick();
    section?.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
    progressEl?.focus({ preventScroll: true });
  }

  async function onanswer(answer: Answer) {
    feedback = answer;
    answers = [...answers, answer];
    tooltipDismissed = false;
    await tick();
    moveFocus(feedbackEl, afterAnswerEl);
  }

  async function next() {
    if (isLast) {
      phase = 'result';
      await tick();
      moveFocus(resultEl);
      return;
    }
    index++;
    feedback = undefined;
    await tick();
    moveFocus(progressEl);
  }

  async function tryAgain() {
    startRound();
    await tick();
    moveFocus(progressEl);
  }

  function dotClass(position: number): string {
    const answered = answers[position];
    if (answered) return answered.correct ? 'bg-success' : 'bg-danger';
    if (position === index)
      return 'bg-accent ring-2 ring-accent-soft ring-offset-1 ring-offset-card';
    return 'bg-border';
  }
</script>

<div
  style:min-height={minHeight > 0 ? `${minHeight}px` : undefined}
  data-phase={phase}
  bind:this={rootEl}
>
  <div bind:this={contentEl}>
    {#if phase === 'intro'}
      <button
        type="button"
        class="inline-flex h-10 items-center rounded-ui bg-accent px-4 font-semibold text-accent-fg disabled:opacity-50"
        disabled={!ready}
        onclick={start}
      >
        {strings['exercise.start']}
      </button>
    {:else if phase === 'question' && current}
      <div class="flex items-center justify-between gap-3">
        <p class="scroll-mt-16 text-sm text-muted" tabindex="-1" bind:this={progressEl}>
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
        <!-- scroll-mb: clear of the mobile bottom bar when scrolled into view. -->
        <div
          class="scroll-mb-16 lg:scroll-mb-4 motion-safe:animate-appear"
          bind:this={afterAnswerEl}
        >
          <div
            class={[
              'mt-3 rounded-ui border px-3 py-2',
              feedback.correct ? 'border-success bg-success-soft' : 'border-danger bg-danger-soft',
            ]}
            tabindex="-1"
            data-testid="feedback"
            bind:this={feedbackEl}
          >
            <div class="flex items-start justify-between gap-3">
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
              <!--
            A quiet icon with a tooltip (hover and keyboard focus; Escape hides it, WCAG 1.4.13).
            The tooltip sits inside the link, so the pointer can move onto it.
          -->
              <a
                href={reportMistakeUrl({ repo, pageUrl, locale, itemId: current.id })}
                target="_blank"
                rel="noopener"
                class="group relative -me-1.5 -mt-0.5 inline-grid size-7 shrink-0 place-items-center rounded-ui text-muted hover:text-fg"
                onkeydown={(event) => {
                  if (event.key === 'Escape') tooltipDismissed = true;
                }}
                onmouseleave={() => (tooltipDismissed = false)}
                onblur={() => (tooltipDismissed = false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 21V4" />
                  <path d="M5 4h12l-2.5 4.5L17 13H5" />
                </svg>
                <span class="sr-only">{strings['exercise.reportMistake']}</span>
                <span
                  aria-hidden="true"
                  class={[
                    'invisible absolute end-full top-1/2 -translate-y-1/2 pe-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100',
                    tooltipDismissed && 'hidden',
                  ]}
                >
                  <span
                    class="block whitespace-nowrap rounded-ui bg-fg px-2 py-1 text-xs text-bg shadow-pop"
                    >{strings['exercise.reportMistake']}</span
                  >
                </span>
              </a>
            </div>
            {#if !feedback.correct}
              <p class="mt-1">
                {strings['exercise.correctAnswer']}
                <span lang="de" class="german font-semibold">{feedback.solution}</span>
              </p>
            {/if}
            {#if current.why}
              <p class="mt-1"><MarkedText text={current.why} /></p>
            {/if}
          </div>
          <button
            type="button"
            class="mt-3 inline-flex h-10 items-center rounded-ui bg-accent px-4 font-semibold text-accent-fg"
            onclick={next}
          >
            {isLast ? strings['exercise.showResult'] : strings['exercise.next']}
          </button>
        </div>
      {/if}
    {:else if phase === 'result'}
      <h3 class="scroll-mt-16 text-lg" tabindex="-1" bind:this={resultEl}>
        {strings['exercise.resultTitle']}
      </h3>
      <p class="mt-1" data-testid="score">
        {format(strings['exercise.result'], { correct: score, total: round.length })}
      </p>
      <!-- Every answer of the round: the learner's sentence, and the correct one when it was wrong. -->
      <ol
        class="mt-3 divide-y divide-border rounded-ui border border-border bg-card"
        data-testid="answers"
      >
        {#each answers as answer, position (position)}
          <li class="flex items-start gap-2.5 px-3 py-2">
            <span
              class={[
                'mt-1 grid size-5 shrink-0 place-items-center rounded-full text-xs leading-none text-card',
                answer.correct ? 'bg-success' : 'bg-danger',
              ]}
              aria-hidden="true">{answer.correct ? '✓' : '✗'}</span
            >
            <div class="min-w-0">
              <p>
                <span class="sr-only"
                  >{answer.correct
                    ? strings['exercise.correct']
                    : strings['exercise.incorrect']}</span
                >
                <span lang="de" class={['german', !answer.correct && 'text-muted line-through']}
                  >{answer.given}</span
                >
                {#if answer.region === 'AT'}
                  <span class="ms-1 inline-flex items-center gap-1.5 align-middle text-sm">
                    <span class="flag" aria-hidden="true"></span>
                    {strings['topic.austrianUsage']}
                  </span>
                {/if}
              </p>
              {#if !answer.correct}
                <p>
                  <span class="sr-only">{strings['exercise.correctAnswer']}</span>
                  <span lang="de" class="german font-semibold">{answer.solution}</span>
                </p>
              {/if}
            </div>
          </li>
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
</div>
