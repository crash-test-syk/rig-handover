import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const NORMAL = '2026-01-01';
const EMPTY = '2026-01-02';
const ONE_BAD = '2026-01-03';
const TWO_BAD = '2026-01-04';
const MISSING = '2026-01-05';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify(error === undefined ? { at, job, status, owner } : { at, job, status, owner, error });

const normalNight = [
  line('2026-01-01T02:00:00+01:00', 'zeta/backup', 'ok', null),
  line('2026-01-01T01:00:00+01:00', 'alpha/sync', 'retry', 'rook', 'upstream 503'),
  line('2026-01-01T01:01:00+01:00', 'alpha/sync', 'retry', 'rook'),
  line('2026-01-01T01:02:00+01:00', 'alpha/sync', 'retry', 'rook'),
  line('2026-01-01T01:03:00+01:00', 'alpha/sync', 'ok', 'rook'),
].join('\n');

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-'));
  writeFileSync(join(runsDir, `${NORMAL}.jsonl`), `${normalNight}\n`);
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(join(runsDir, `${ONE_BAD}.jsonl`), `${line('2026-01-03T01:00:00+01:00', 'alpha/sync', 'ok', 'rook')}\nnot json\n`);
  writeFileSync(join(runsDir, `${TWO_BAD}.jsonl`), 'nope\n{"at":1}\n');
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function pageRows(html: string): { job: string; tr: string }[] {
  return [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)]
    .map((m) => m[0])
    .filter((tr) => !tr.includes('<th'))
    .map((tr) => {
      const firstCell = /<td\b[^>]*>([\s\S]*?)<\/td>/.exec(tr)?.[1] ?? '';
      return { job: firstCell.replace(/<[^>]*>/g, '').trim(), tr };
    });
}

describe('GET /digest/:night', () => {
  it('renders the banner, heading and one row per job in job order', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await app.request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain(`<h1>digest · ${NORMAL}</h1>`);
    expect(pageRows(html).map((r) => r.job)).toEqual(['alpha/sync', 'zeta/backup']);
  });

  it('marks the row with 3 retries as warn and shows missing data as a dash', async () => {
    const rows = pageRows(await (await app.request(`/digest/${NORMAL}`)).text());
    const [alpha, zeta] = rows;
    expect(alpha?.tr).toMatch(/^<tr[^>]*class="warn"/);
    expect(zeta?.tr).not.toContain('warn');
    expect(zeta?.tr).toContain('—');
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('counts unreadable lines, singular and plural', async () => {
    const one = await app.request(`/digest/${ONE_BAD}`);
    expect(one.status).toBe(200);
    expect(await one.text()).toContain('1 line could not be read');
    const two = await app.request(`/digest/${TWO_BAD}`);
    expect(await two.text()).toContain('2 lines could not be read');
  });

  it('answers 404 for a night with no file and for an invalid night', async () => {
    expect((await app.request(`/digest/${MISSING}`)).status).toBe(404);
    expect((await app.request('/digest/not-a-night')).status).toBe(404);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the night as JSON', async () => {
    const res = await app.request(`/api/digest/${NORMAL}`);
    const json = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(json.night).toBe(NORMAL);
    expect(json.counts).toEqual({ ok: 2, retry: 3, fail: 0 });
    expect(json.badLines).toBe(0);
    expect(json.rows.map((r) => r.job)).toEqual(['alpha/sync', 'zeta/backup']);
    expect(json.rows[0]).toMatchObject({ retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(json.rows[1]).toMatchObject({ owner: null, lastError: null });
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY, rows: [], counts: { ok: 0, retry: 0, fail: 0 }, badLines: 0 });
  });

  it('reports the bad line count', async () => {
    const res = await app.request(`/api/digest/${ONE_BAD}`);
    const json = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(json.badLines).toBe(1);
    expect(json.rows.map((r) => r.job)).toEqual(['alpha/sync']);
  });

  it('answers 404 with an error body for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for that night' });
  });
});

describe('page and JSON agree', () => {
  it.each([NORMAL, ONE_BAD])('list the same jobs in the same order for %s', async (night) => {
    const html = await (await app.request(`/digest/${night}`)).text();
    const json = (await (await app.request(`/api/digest/${night}`)).json()) as Night;
    expect(pageRows(html).map((r) => r.job)).toEqual(json.rows.map((r) => r.job));
  });
});
