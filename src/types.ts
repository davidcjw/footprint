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
}
