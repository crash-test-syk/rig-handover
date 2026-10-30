import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on the real night', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads five jobs sorted by job, with one bad line', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('keeps the last error after a later ok, and the offset in times', () => {
    expect(night?.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('shows a failed job and keeps a row with no owner', () => {
    expect(night?.rows.find((r) => r.job === 'notes/backup')?.lastStatus).toBe('fail');
    expect(night?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    writeFileSync(join(dir, 'x.jsonl'), '');
    expect(readNight(dir, '../x')).toBeNull();
    expect(readNight(dir, 'x')).toBeNull();
    expect(readNight(dir, '2026-1-01')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('counts unparseable and invalid lines as bad, and skips blank lines', () => {
    const lines = [
      '{"at":"2026-01-01T01:00:00+02:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T01:0',
      '{"at":"2026-01-01T02:00:00+02:00","job":"a","status":"done","owner":"x"}',
      '{"job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T03:00:00+02:00","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T04:00:00+02:00","job":"a","status":"ok","owner":7}',
      '[]',
      '',
      '{"at":"2026-01-01T05:00:00+02:00","job":"a","status":"fail","owner":null,"error":"boom"}',
      '',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n'));
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(6);
    expect(night?.counts).toEqual({ ok: 1, retry: 0, fail: 1 });
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 2,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'boom',
        firstAt: '2026-01-01T01:00:00+02:00',
        lastAt: '2026-01-01T05:00:00+02:00',
      },
    ]);
  });
});
