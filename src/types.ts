export interface Commit {
  hash: string;
  subject: string;
  date: string; // ISO author date
  added: number;
  deleted: number;
}

export interface RepoSummary {
  name: string;
  path: string;
  commits: Commit[];
  added: number;
  deleted: number;
}

export interface Footprint {
  date: string; // YYYY-MM-DD (local)
  dateLabel: string; // e.g. "Thu 26 Jun 2026"
  authors: string[];
  repos: RepoSummary[];
  totalCommits: number;
  totalAdded: number;
  totalDeleted: number;
  /** file-extension -> lines changed, top languages */
  languages: { ext: string; changes: number }[];
  /** Claude Code token usage + cost for the period, when available */
  usage?: import("./usage.js").UsageSummary;
  period: "day" | "month";
  /** commits per day-of-month (index 0 = day 1); only set for the month view */
  activity?: number[];
}
