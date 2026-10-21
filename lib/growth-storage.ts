import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLocalDateKey } from '@/lib/expense-record';
import {
  applyAttendanceReward,
  applyDailyReflectionReward,
  applyExpenseRecordReward,
  createInitialGrowthState,
  GROWTH_STORAGE_KEY,
  GrowthState,
  normalizeGrowthState,
  RewardResult,
} from '@/lib/growth';

let growthOperationQueue: Promise<void> = Promise.resolve();

function runGrowthOperation<T>(operation: () => Promise<T>) {
  const result = growthOperationQueue.then(operation, operation);
  growthOperationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function readGrowthState() {
  const storedState = await AsyncStorage.getItem(GROWTH_STORAGE_KEY);

  if (storedState === null) {
    return createInitialGrowthState();
  }

  try {
    return normalizeGrowthState(JSON.parse(storedState));
  } catch (error) {
    console.error('캐릭터 성장 데이터를 해석하지 못했습니다.', error);
    return createInitialGrowthState();
  }
}

export function loadGrowthState() {
  return runGrowthOperation(readGrowthState);
}

async function applyAndPersistReward(
  applyReward: (state: GrowthState) => RewardResult
) {
  return runGrowthOperation(async () => {
    const currentState = await readGrowthState();
    const result = applyReward(currentState);

    if (!result.granted) {
      return result;
    }

    await AsyncStorage.setItem(GROWTH_STORAGE_KEY, JSON.stringify(result.state));
    return result;
  });
}

export function grantAttendanceReward(visitedAt = new Date()) {
  const actionDate = getLocalDateKey(visitedAt);
  const grantedAt = visitedAt.toISOString();

  return applyAndPersistReward((state) =>
    applyAttendanceReward(state, actionDate, grantedAt)
  );
}

export function grantExpenseRecordReward(input: {
  actionDate?: string;
  grantedAt?: string;
  isFirstRecordOfDate: boolean;
  recordId: string;
  targetDate: string;
}) {
  const now = new Date();
  const actionDate = input.actionDate ?? getLocalDateKey(now);
  const grantedAt = input.grantedAt ?? now.toISOString();

  return applyAndPersistReward((state) =>
    applyExpenseRecordReward(state, {
      actionDate,
      grantedAt,
      isFirstRecordOfDate: input.isFirstRecordOfDate,
      recordId: input.recordId,
      targetDate: input.targetDate,
    })
  );
}

export function grantDailyReflectionReward(input: {
  actionDate?: string;
  grantedAt?: string;
  targetDate: string;
}) {
  const now = new Date();
  const actionDate = input.actionDate ?? getLocalDateKey(now);
  const grantedAt = input.grantedAt ?? now.toISOString();

  return applyAndPersistReward((state) =>
    applyDailyReflectionReward(state, {
      actionDate,
      grantedAt,
      targetDate: input.targetDate,
    })
  );
}
