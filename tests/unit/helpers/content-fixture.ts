/**
 * A temporary copy of the valid fixture content (tests/fixtures/content: the topic
 * topics/a2/sample and the reference page reference/sample) with review.yaml synced for both, so
 * each test can apply one change to one of them and check the result.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type ContentKind,
  type ContentRoots,
  readReferencePage,
  readTopic,
  type TopicFiles,
} from '../../../scripts/lib/content.ts';
import { readReview, serializeReview, syncReview } from '../../../scripts/review.ts';

const FIXTURE = join(import.meta.dirname, '../../fixtures/content');

export interface ContentFixture {
  /** Content roots of the copy, for validateContent() and the review CLI */
  roots: ContentRoots;
  /** Folder of the fixture this instance edits */
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

/** `kind` picks the folder the fixture edits: the topic (default) or the reference page. */
export function contentFixture(kind: ContentKind = 'topic'): ContentFixture {
  const root = mkdtempSync(join(tmpdir(), 'deutscherl-content-'));
  cpSync(FIXTURE, root, { recursive: true });
  const roots = { topics: join(root, 'topics'), reference: join(root, 'reference') };
  const read = {
    topic: () => readTopic(roots.topics, 'a2', 'sample'),
    reference: () => readReferencePage(roots.reference, 'sample'),
  };
  const dir =
    kind === 'topic' ? join(roots.topics, 'a2', 'sample') : join(roots.reference, 'sample');
  const syncFolder = (unit: TopicFiles) => {
    const { review, changes } = syncReview(unit, readReview(unit));
    writeFileSync(join(unit.dir, 'review.yaml'), serializeReview(review));
    return changes;
  };
  const fixture: ContentFixture = {
    roots,
    dir,
    topic: read[kind],
    read: (file) => readFileSync(join(dir, file), 'utf8'),
    write: (file, content) => writeFileSync(join(dir, file), content),
    edit: (file, change) => fixture.write(file, change(fixture.read(file))),
    remove: (file) => rmSync(join(dir, file)),
    sync: () => syncFolder(fixture.topic()),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
  syncFolder(read.topic());
  syncFolder(read.reference());
  return fixture;
}
