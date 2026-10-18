/**
 * Grammar references for /about/sources/ (pure, unit-tested; decision #78): the `sources` of every
 * topic's meta.yaml, de-duplicated (same URL, or same title when there is no URL) and grouped by
 * website. Each source lists the topics that use it.
 */

export interface TopicSources {
  /** `a2/perfekt` */
  key: string;
  sources: readonly { title: string; url?: string | undefined }[];
}

export interface SourceEntry {
  title: string;
  url: string | undefined;
  /** Topic keys in the order they were given */
  topics: string[];
}

export interface SourceGroup {
  /** Website (`duden.de`); undefined for sources without a URL (books) */
  site: string | undefined;
  sources: SourceEntry[];
}

/**
 * Website of a URL for grouping: the host without `www.` and without subdomains
 * (`grammis.ids-mannheim.de` → `ids-mannheim.de`). Two-part public suffixes such as `co.uk` are
 * not handled; the pilot's sources do not need them.
 */
export function siteOf(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  return host.split('.').slice(-2).join('.');
}

/** URL without fragment and trailing slash, host lowercased: the identity of a source. */
function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.href.replace(/\/$/, '');
}

const collator = new Intl.Collator('de');

export function groupSources(topics: readonly TopicSources[]): SourceGroup[] {
  const entries = new Map<string, SourceEntry>();
  for (const topic of topics) {
    for (const source of topic.sources) {
      const id = source.url ? normalizeUrl(source.url) : `title:${source.title.trim()}`;
      let entry = entries.get(id);
      if (!entry) {
        entry = { title: source.title.trim(), url: source.url, topics: [] };
        entries.set(id, entry);
      }
      if (!entry.topics.includes(topic.key)) entry.topics.push(topic.key);
    }
  }

  const groups = new Map<string | undefined, SourceEntry[]>();
  for (const entry of entries.values()) {
    const site = entry.url ? siteOf(entry.url) : undefined;
    groups.set(site, [...(groups.get(site) ?? []), entry]);
  }
  return [...groups.entries()]
    .map(([site, sources]) => ({
      site,
      sources: sources.sort((a, b) => collator.compare(a.title, b.title)),
    }))
    .sort((a, b) => {
      if (a.site === undefined) return 1;
      if (b.site === undefined) return -1;
      return collator.compare(a.site, b.site);
    });
}
