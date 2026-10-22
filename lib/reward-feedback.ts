import { RewardResult } from '@/lib/growth';

export type RewardFeedbackAnchor =
  | 'left-top'
  | 'right-top'
  | 'left'
  | 'right'
  | 'upper-center';

export type RewardFeedback = {
  anchor: RewardFeedbackAnchor;
  exp: number;
  id: string;
  points: number;
};

const ANCHORS: RewardFeedbackAnchor[] = [
  'left-top',
  'right-top',
  'left',
  'right',
  'upper-center',
];

let feedbackSequence = 0;
let pendingFeedback: RewardFeedback[] = [];

export function createRewardFeedback(result: RewardResult): RewardFeedback | null {
  if (!result.granted || (result.grantedExp <= 0 && result.grantedPoints <= 0)) {
    return null;
  }

  const sequence = feedbackSequence;
  feedbackSequence += 1;

  return {
    anchor: ANCHORS[sequence % ANCHORS.length],
    exp: result.grantedExp,
    id: `reward-feedback-${Date.now()}-${sequence}`,
    points: result.grantedPoints,
  };
}

export function queueRewardFeedback(result: RewardResult) {
  const feedback = createRewardFeedback(result);

  if (feedback !== null) {
    pendingFeedback = [...pendingFeedback.slice(-2), feedback];
  }
}

export function consumeRewardFeedback() {
  const feedback = pendingFeedback;
  pendingFeedback = [];
  return feedback;
}
