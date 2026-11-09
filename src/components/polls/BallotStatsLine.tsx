/**
 * The host's honest count: phones, not submissions.
 *
 * Each phone holds one ballot. Changing your mind rewrites it, so
 * "changed their mind" is shown to explain the activity without adding to
 * the total.
 */

import type { PollBallotStats } from "../../types/polls";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function BallotStatsLine({ stats }: { stats: PollBallotStats }) {
  const parts = [plural(stats.phones, "phone", "phones")];
  if (stats.guests) parts.push(`${stats.guests} not on a team`);
  if (stats.judges) parts.push(plural(stats.judges, "judge", "judges"));
  if (stats.changedMind) parts.push(`${stats.changedMind} changed their mind`);
  if (stats.notCounted) parts.push(`${stats.notCounted} not counted`);
  if (!stats.phones && !stats.judges) return null;
  return <span>{` · ${parts.join(" · ")}`}</span>;
}
