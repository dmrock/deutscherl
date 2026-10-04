<!--
  Multiple choice: a German sentence with one gap and 2–4 options (already shuffled). One click
  answers; regional variants (`alsoCorrect`) count as correct (decision #13).
-->
<script lang="ts">
  import type { ExerciseStrings } from '../../lib/exercise-strings.ts';
  import {
    type Answer,
    checkChoice,
    fillGap,
    type PreparedChoice,
    splitGap,
  } from '../../lib/exercises.ts';

  interface Props {
    item: PreparedChoice;
    strings: ExerciseStrings;
    locale: string;
    onanswer: (answer: Answer) => void;
  }

  let { item, strings, locale, onanswer }: Props = $props();
  let chosen = $state<string>();
  const gap = $derived(splitGap(item.text));
  const result = $derived(chosen === undefined ? undefined : checkChoice(item, chosen));

  function choose(option: string) {
    if (chosen !== undefined) return;
    chosen = option;
    const { correct, region } = checkChoice(item, option);
    onanswer({ correct, region, solution: fillGap(item.text, item.answer) });
  }

  function optionState(option: string): 'right' | 'wrong' | 'idle' {
    if (!result) return 'idle';
    if (option === chosen) return result.correct ? 'right' : 'wrong';
    if (!result.correct && option === item.answer) return 'right';
    return 'idle';
  }
</script>

<p class="text-muted">{strings['exercise.choice.prompt']}</p>
<p lang="de" class="german mt-1 text-lg" data-testid="choice-sentence">
  {gap[0]}{#if chosen === undefined}<span
      class="inline-block w-14 border-b-2 border-control align-baseline"
      >&nbsp;<span class="sr-only" lang={locale}>{strings['exercise.choice.blank']}</span></span
    >{:else}<strong class={result?.correct ? 'text-success' : 'text-danger'}>{chosen}</strong
    >{/if}{gap[1]}
</p>
<div role="group" aria-label={strings['exercise.choice.options']} class="mt-3 flex flex-wrap gap-2">
  {#each item.shuffledOptions as option (option)}
    {@const state = optionState(option)}
    <button
      type="button"
      lang="de"
      class={[
        'german inline-flex min-h-11 min-w-16 items-center justify-center gap-1.5 rounded-ui border px-4 font-semibold',
        state === 'idle' && 'border-control bg-card',
        state === 'idle' && chosen === undefined && 'hover:bg-surface',
        state === 'idle' && chosen !== undefined && 'text-muted',
        state === 'right' && 'border-success bg-success-soft text-success',
        state === 'wrong' && 'border-danger bg-danger-soft text-danger',
      ]}
      disabled={chosen !== undefined}
      aria-pressed={chosen === option}
      onclick={() => choose(option)}
    >
      {#if state === 'right'}<span aria-hidden="true">✓</span>{/if}
      {#if state === 'wrong'}<span aria-hidden="true">✗</span>{/if}
      {option}
    </button>
  {/each}
</div>
