import AsyncStorage from '@react-native-async-storage/async-storage';

import { CharacterStage, getCharacterStage, RewardResult } from '@/lib/growth';

export const GROWTH_CELEBRATION_STORAGE_KEY = '@my-money-app/growth-celebrations';

type GrowthCelebrationState = {
  pending: GrowthCelebration | null;
  shownStageIds: CharacterStage['id'][];
  version: 1;
};

export type GrowthCelebration = {
  stageId: CharacterStage['id'];
  totalExp: number;
};

const STAGE_IDS: CharacterStage['id'][] = [
  'EGG',
  'CHICK',
  'GROWING_CHICKEN',
  'CHICKEN',
  'MYSTERY',
];

let celebrationOperationQueue: Promise<void> = Promise.resolve();

function runCelebrationOperation<T>(operation: () => Promise<T>) {
  const result = celebrationOperationQueue.then(operation, operation);
  celebrationOperationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function createInitialCelebrationState(): GrowthCelebrationState {
  return { pending: null, shownStageIds: [], version: 1 };
}

function isStageId(value: unknown): value is CharacterStage['id'] {
  return typeof value === 'string' && STAGE_IDS.includes(value as CharacterStage['id']);
}

function normalizeCelebrationState(value: unknown): GrowthCelebrationState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return createInitialCelebrationState();
  }

  const stored = value as Partial<GrowthCelebrationState>;
  const shownStageIds = Array.isArray(stored.shownStageIds)
    ? stored.shownStageIds.filter(isStageId)
    : [];
  const pending =
    typeof stored.pending === 'object' &&
    stored.pending !== null &&
    isStageId(stored.pending.stageId) &&
    typeof stored.pending.totalExp === 'number' &&
    Number.isFinite(stored.pending.totalExp)
      ? {
          stageId: stored.pending.stageId,
          totalExp: Math.max(0, stored.pending.totalExp),
        }
      : null;

  return {
    pending,
    shownStageIds: [...new Set(shownStageIds)],
    version: 1,
  };
}

async function readCelebrationState() {
  const stored = await AsyncStorage.getItem(GROWTH_CELEBRATION_STORAGE_KEY);

  if (stored === null) {
    return createInitialCelebrationState();
  }

  try {
    return normalizeCelebrationState(JSON.parse(stored));
  } catch (error) {
    console.error('성장 축하 상태를 해석하지 못했습니다.', error);
    return createInitialCelebrationState();
  }
}

export function recordPendingGrowthCelebration(result: RewardResult) {
  return runCelebrationOperation(async () => {
    if (!result.granted || result.grantedExp <= 0) {
      return;
    }

    const previousStage = getCharacterStage(result.state.totalExp - result.grantedExp);
    const currentStage = getCharacterStage(result.state.totalExp);

    if (previousStage.id === currentStage.id) {
      return;
    }

    const state = await readCelebrationState();

    if (
      state.pending?.stageId === currentStage.id ||
      state.shownStageIds.includes(currentStage.id)
    ) {
      return;
    }

    await AsyncStorage.setItem(
      GROWTH_CELEBRATION_STORAGE_KEY,
      JSON.stringify({
        ...state,
        pending: { stageId: currentStage.id, totalExp: result.state.totalExp },
      } satisfies GrowthCelebrationState)
    );
  });
}

export function consumePendingGrowthCelebration() {
  return runCelebrationOperation<GrowthCelebration | null>(async () => {
    const state = await readCelebrationState();

    if (state.pending === null) {
      return null;
    }

    const celebration = state.pending;
    await AsyncStorage.setItem(
      GROWTH_CELEBRATION_STORAGE_KEY,
      JSON.stringify({
        pending: null,
        shownStageIds: [...new Set([...state.shownStageIds, celebration.stageId])],
        version: 1,
      } satisfies GrowthCelebrationState)
    );

    return celebration;
  });
}
