/**
 * Inline markers in content text (pure, unit-tested):
 * - `**…**` in German examples (german.yaml) highlights key words, e.g. the Perfekt verb forms;
 * - `*…*` in native-language text (summary, why texts) marks a German word (rendered with lang="de").
 */

export interface Segment {
  text: string;
  marked: boolean;
}

/** Splits `text` at `marker`: every second segment is marked. Empty segments are dropped. */
export function splitMarked(text: string, marker: '**' | '*'): Segment[] {
  return text
    .split(marker)
    .map((part, index) => ({ text: part, marked: index % 2 === 1 }))
    .filter((segment) => segment.text !== '');
}

/** Text without markers (meta descriptions, speech, link titles). */
export function stripMarks(text: string): string {
  return text.replaceAll('*', '');
}
