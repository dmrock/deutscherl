/**
 * A temporary copy of the valid fixture topic (tests/fixtures/content/topics/a2/sample) with its
 * review.yaml synced, so each test can apply one change and check the result.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTopic, type TopicFiles } from '../../../scripts/lib/content.ts';
import { readReview, serializeReview, syncReview } from '../../../scripts/review.ts';

const FIXTURE = join(import.meta.dirname, '../../fixtures/content/topics');

export interface ContentFixture {
  root: string;
  dir: string;
  topic(): TopicFiles;
  read(file: string): string;
  write(file: string, content: string): void;
  edit(file: string, change: (content: string) => string): void;
  remove(file: string): void;
  /** Runs review sync and writes review.yaml, like the pre-commit hook. */
  sync(): string[];
  cleanup(): void;
}

export function contentFixture(): ContentFixture {
  const root = mkdtempSync(join(tmpdir(), 'deutscherl-content-'));
  cpSync(FIXTURE, root, { recursive: true });
  const dir = join(root, 'a2', 'sample');
  const fixture: ContentFixture = {
    root,
    dir,
    topic: () => readTopic(root, 'a2', 'sample'),
    read: (file) => readFileSync(join(dir, file), 'utf8'),
    write: (file, content) => writeFileSync(join(dir, file), content),
    edit: (file, change) => fixture.write(file, change(fixture.read(file))),
    remove: (file) => rmSync(join(dir, file)),
    sync: () => {
      const topic = fixture.topic();
      const { review, changes } = syncReview(topic, readReview(topic));
      fixture.write('review.yaml', serializeReview(review));
      return changes;
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
  fixture.sync();
  return fixture;
}
