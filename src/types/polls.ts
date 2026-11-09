/**
 * Best-project polls. One ballot per phone: 3, 2, and 1 points, never
 * to the team that phone belongs to.
 */

export type PollStatus = "draft" | "live" | "closed";

export interface PollOption {
  id: string;
  label: string;
  people: string;
  url: string;
}

export interface PollResultOption extends PollOption {
  points: number;
  /** Raw room points before the 50/50 blend. */
  audiencePoints?: number;
  /** Raw judge points before the 50/50 blend. */
  judgePoints?: number;
  /** This project's slice of the room's 50. */
  audienceShare?: number;
  /** This project's slice of the judges' 50. */
  judgeShare?: number;
  firsts: number;
  seconds: number;
  thirds: number;
  place: number;
  /** Points, under the old field name so result bars still have a number. */
  votes: number;
}

export interface PollPublic {
  id: string;
  slug: string;
  question: string;
  options: PollOption[];
  status: PollStatus;
  eventId: string;
  eventTitle: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
  /** ISO time the host set for the final minute. Empty until they start it. */
  closesAt: string;
  results: PollResultOption[];
  scoresHidden: boolean;
  totalVotes: number;
  audienceVotes?: number;
  judgeVotes?: number;
  /** True once both room and judges have cast at least one ballot. */
  weighted?: boolean;
  /** When the server read these ballots. Older snapshots are dropped. */
  asOf?: string;
  yourOptionId: string | null;
  yourFirstId: string | null;
  yourSecondId: string | null;
  yourThirdId: string | null;
  /** The project this phone said it is on. */
  yourTeamId: string | null;
}

/** Counts a host can check against the room. Each phone holds one ballot. */
export interface PollBallotStats {
  /** Phones with a ballot (not judges). */
  phones: number;
  /** Phones that said they weren't on a team. */
  guests: number;
  judges: number;
  /** Phones that resubmitted. Still one ballot each. */
  changedMind: number;
  /** Ballots that point at a removed project or the voter's own team. */
  notCounted: number;
}

export interface PollAdmin extends PollPublic {
  createdByPersonId: string;
  createdByName: string;
  ballotStats?: PollBallotStats;
}

export interface PollsAdminPayload {
  canManage: boolean;
  polls: PollAdmin[];
}
