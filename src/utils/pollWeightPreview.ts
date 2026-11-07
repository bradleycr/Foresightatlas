/**
 * Sample final for the projector. Not real ballots.
 *
 * Two judges together are always half the score. The room is the other half.
 * Room size never changes that split: each side is scaled to 50 before adding.
 */

import type { PollOption, PollResultOption } from "../types/polls";

/** Raw room points in the sample. Sum is 120; the count of phones is irrelevant. */
const ROOM_POINTS: Record<string, number> = {
  "Do LLMs Argue Like Humans?": 36,
  ChainSentinel: 24,
  "Predictive Lens": 18,
  micrograph: 12,
  "Dr Drerio": 6,
  Plov: 6,
  BauCode: 6,
  "Shift Happens": 4,
  "Science Resocialized": 3,
  MetaboliteSensorFinder: 2,
  KaAnOm: 1,
  meowlignment: 1,
  "llm-lying-detection": 1,
};

/**
 * Two judge ballots, 3 + 2 + 1 each, both agreeing.
 * Dr Drerio 6, BauCode 4, Shift Happens 2. Sum is 12.
 */
const JUDGE_POINTS: Record<string, number> = {
  "Dr Drerio": 6,
  BauCode: 4,
  "Shift Happens": 2,
};

function roundTenth(n: number) {
  return Math.round(n * 10) / 10;
}

export function previewWeightedResults(options: PollOption[]): PollResultOption[] {
  const roomSum = options.reduce((sum, option) => sum + (ROOM_POINTS[option.label] || 0), 0);
  const judgeSum = options.reduce((sum, option) => sum + (JUDGE_POINTS[option.label] || 0), 0);

  const ranked: PollResultOption[] = options.map((option) => {
    const audiencePoints = ROOM_POINTS[option.label] || 0;
    const judgePoints = JUDGE_POINTS[option.label] || 0;
    const audienceShare = roomSum > 0 ? (audiencePoints / roomSum) * 50 : 0;
    const judgeShare = judgeSum > 0 ? (judgePoints / judgeSum) * 50 : 0;
    const points = roundTenth(audienceShare + judgeShare);
    return {
      ...option,
      points,
      votes: points,
      audiencePoints,
      judgePoints,
      audienceShare: roundTenth(audienceShare),
      judgeShare: roundTenth(judgeShare),
      firsts: 0,
      seconds: 0,
      thirds: 0,
      place: 0,
    };
  });

  ranked.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if ((b.judgePoints || 0) !== (a.judgePoints || 0)) {
      return (b.judgePoints || 0) - (a.judgePoints || 0);
    }
    return a.label.localeCompare(b.label);
  });

  ranked.forEach((row, index) => {
    const prev = ranked[index - 1];
    const tied =
      prev &&
      prev.points === row.points &&
      (prev.judgePoints || 0) === (row.judgePoints || 0);
    row.place = tied ? prev.place : index + 1;
  });

  return ranked;
}

export const PREVIEW_ROOM_BALLOTS = 40;
export const PREVIEW_JUDGE_BALLOTS = 2;
