import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { t } from '../../src/i18n/utils.ts';
import { exerciseStrings } from '../../src/lib/exercise-strings.ts';

describe('exerciseStrings()', () => {
  it('contains only the strings the island needs, in the requested locale', () => {
    const strings = exerciseStrings('ru');
    const keys = Object.keys(strings);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.every((key) => key.startsWith('exercise.') || key === 'topic.austrianUsage')).toBe(
      true,
    );
    expect(strings['exercise.check']).toBe(t('ru', 'exercise.check'));
  });

  it('leaves placeholders for the island', () => {
    expect(exerciseStrings('en')['exercise.progress']).toContain('{current}');
  });
});

describe('report-mistake issue form', () => {
  it('has the field ids that the report link prefills', () => {
    const form = parse(
      readFileSync(
        join(import.meta.dirname, '../../.github/ISSUE_TEMPLATE/report-mistake.yml'),
        'utf8',
      ),
    ) as { body: { id?: string }[] };
    const ids = form.body.map((field) => field.id);
    expect(ids).toEqual(expect.arrayContaining(['page-url', 'locale', 'item-id']));
  });
});
