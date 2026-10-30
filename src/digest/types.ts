// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One parsed line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job in a night.
export type DigestRow = {
  job: string;
  // Owner on the job's last line. Views show null as '—'.
  owner: string | null;
  // Lines for this job.
  runs: number;
  // Lines with status 'retry'.
  retries: number;
  lastStatus: RunStatus;
  // Most recent error seen for this job, even if a later run was ok.
  lastError: string | null;
  // Times exactly as in the log, offset kept.
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job. The page and the JSON both use this order (ADR 0001).
  rows: DigestRow[];
  // Lines per status across the night, for the board link.
  counts: Record<RunStatus, number>;
  // Lines that did not parse. Counted, never thrown.
  badLines: number;
};

// `night` is YYYY-MM-DD. Returns null when it is not, or when runs/<night>.jsonl does not exist.
// An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
