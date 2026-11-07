/**
 * Best-project polls. One ballot per phone: a favorite (2 points) and a
 * runner-up (1). Scores stay hidden until the host closes the poll.
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
  firsts: number;
  seconds: number;
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
  results: PollResultOption[];
  scoresHidden: boolean;
  totalVotes: number;
  yourOptionId: string | null;
  yourFirstId: string | null;
  yourSecondId: string | null;
}

export interface PollAdmin extends PollPublic {
  createdByPersonId: string;
  createdByName: string;
}

export interface PollsAdminPayload {
  canManage: boolean;
  polls: PollAdmin[];
}
