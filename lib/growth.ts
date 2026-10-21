export const GROWTH_STORAGE_KEY = '@my-money-app/growth-state';

export const GROWTH_CONFIG = {
  attendanceExp: 10,
  attendancePointCycle: [10, 10, 15, 15, 20, 20, 50],
  attendanceMilestones: {
    7: { exp: 30, points: 30 },
    30: { exp: 100, points: 100 },
  },
  currentDateFirstExpense: { exp: 5, points: 3 },
  currentDateAdditionalExpense: { exp: 2, points: 1 },
  currentDateAdditionalExpenseCap: 3,
  currentDateReflection: { exp: 10, points: 5 },
  pastExpense: { exp: 2, points: 1 },
  pastReflection: { exp: 3, points: 2 },
  pastActionDailyCap: 5,
  stages: [
    { id: 'EGG', name: '알', minimumExp: 0 },
    { id: 'CHICK', name: '병아리', minimumExp: 80 },
    { id: 'GROWING_CHICKEN', name: '중닭', minimumExp: 250 },
    { id: 'CHICKEN', name: '닭', minimumExp: 600 },
    { id: 'MYSTERY', name: '???', minimumExp: 1200 },
  ],
} as const;

export type GrowthMode = 'NORMAL' | 'RELAXED' | 'CONSISTENT' | 'HARD';
export type CharacterStage = (typeof GROWTH_CONFIG.stages)[number];
export type RewardType =
  | 'attendance'
  | 'attendance-milestone'
  | 'current-expense-first'
  | 'current-expense-additional'
  | 'current-reflection'
  | 'past-expense'
  | 'past-reflection';

export type RewardEvent = {
  actionDate: string;
  exp: number;
  grantedAt: string;
  id: string;
  points: number;
  sourceId?: string;
  targetDate?: string;
  type: RewardType;
};

export type AttendanceEntry = {
  checkedAt: string;
  cycleDay: number;
  exp: number;
  points: number;
};

export type GrowthState = {
  attendanceHistory: Record<string, AttendanceEntry>;
  currentStreak: number;
  lastAttendanceDate: string | null;
  longestStreak: number;
  mode: GrowthMode;
  rewardHistory: Record<string, RewardEvent>;
  totalExp: number;
  totalPoints: number;
  version: 1;
};

export type RewardResult = {
  granted: boolean;
  grantedExp: number;
  grantedPoints: number;
  reason: 'granted' | 'already-rewarded' | 'daily-cap' | 'future-date';
  state: GrowthState;
};

export type StageProgress = {
  currentExpInStage: number;
  expToNextStage: number;
  nextStage: CharacterStage | null;
  progress: number;
  stage: CharacterStage;
};

export function createInitialGrowthState(): GrowthState {
  return {
    attendanceHistory: {},
    currentStreak: 0,
    lastAttendanceDate: null,
    longestStreak: 0,
    mode: 'NORMAL',
    rewardHistory: {},
    totalExp: 0,
    totalPoints: 0,
    version: 1,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeGrowthState(value: unknown): GrowthState {
  const initialState = createInitialGrowthState();

  if (!isRecord(value)) {
    return initialState;
  }

  const mode = value.mode;
  const validMode: GrowthMode =
    mode === 'NORMAL' || mode === 'RELAXED' || mode === 'CONSISTENT' || mode === 'HARD'
      ? mode
      : 'NORMAL';

  return {
    attendanceHistory: isRecord(value.attendanceHistory)
      ? (value.attendanceHistory as GrowthState['attendanceHistory'])
      : {},
    currentStreak:
      typeof value.currentStreak === 'number' && value.currentStreak >= 0
        ? Math.floor(value.currentStreak)
        : 0,
    lastAttendanceDate:
      typeof value.lastAttendanceDate === 'string' ? value.lastAttendanceDate : null,
    longestStreak:
      typeof value.longestStreak === 'number' && value.longestStreak >= 0
        ? Math.floor(value.longestStreak)
        : 0,
    mode: validMode,
    rewardHistory: isRecord(value.rewardHistory)
      ? (value.rewardHistory as GrowthState['rewardHistory'])
      : {},
    totalExp:
      typeof value.totalExp === 'number' && Number.isFinite(value.totalExp)
        ? Math.max(0, value.totalExp)
        : 0,
    totalPoints:
      typeof value.totalPoints === 'number' && Number.isFinite(value.totalPoints)
        ? Math.max(0, value.totalPoints)
        : 0,
    version: 1,
  };
}

export function getCharacterStage(totalExp: number): CharacterStage {
  const safeExp = Math.max(0, totalExp);

  return [...GROWTH_CONFIG.stages]
    .reverse()
    .find((stage) => safeExp >= stage.minimumExp) ?? GROWTH_CONFIG.stages[0];
}

export function getNextStageProgress(totalExp: number): StageProgress {
  const safeExp = Math.max(0, totalExp);
  const stage = getCharacterStage(safeExp);
  const stageIndex = GROWTH_CONFIG.stages.findIndex((item) => item.id === stage.id);
  const nextStage = GROWTH_CONFIG.stages[stageIndex + 1] ?? null;

  if (nextStage === null) {
    return {
      currentExpInStage: safeExp - stage.minimumExp,
      expToNextStage: 0,
      nextStage: null,
      progress: 1,
      stage,
    };
  }

  const stageExpRange = nextStage.minimumExp - stage.minimumExp;
  const currentExpInStage = safeExp - stage.minimumExp;

  return {
    currentExpInStage,
    expToNextStage: Math.max(0, nextStage.minimumExp - safeExp),
    nextStage,
    progress: Math.min(1, Math.max(0, currentExpInStage / stageExpRange)),
    stage,
  };
}

function localDateToUtcTime(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function getLocalDateDifference(laterDate: string, earlierDate: string) {
  return Math.round(
    (localDateToUtcTime(laterDate) - localDateToUtcTime(earlierDate)) / 86_400_000
  );
}

export function calculateNextStreak(lastAttendanceDate: string | null, actionDate: string) {
  if (lastAttendanceDate === null) {
    return 1;
  }

  const difference = getLocalDateDifference(actionDate, lastAttendanceDate);
  return difference === 1 ? null : difference === 0 ? 0 : 1;
}

function getStreakStartDate(actionDate: string, streak: number) {
  const startDate = new Date(localDateToUtcTime(actionDate));
  startDate.setUTCDate(startDate.getUTCDate() - Math.max(0, streak - 1));
  return startDate.toISOString().slice(0, 10);
}

function withReward(
  state: GrowthState,
  event: RewardEvent,
  extraChanges: Partial<GrowthState> = {}
): RewardResult {
  const nextState: GrowthState = {
    ...state,
    ...extraChanges,
    rewardHistory: {
      ...state.rewardHistory,
      [event.id]: event,
    },
    totalExp: state.totalExp + event.exp,
    totalPoints: state.totalPoints + event.points,
  };

  return {
    granted: true,
    grantedExp: event.exp,
    grantedPoints: event.points,
    reason: 'granted',
    state: nextState,
  };
}

function withoutReward(
  state: GrowthState,
  reason: Exclude<RewardResult['reason'], 'granted'>
): RewardResult {
  return { granted: false, grantedExp: 0, grantedPoints: 0, reason, state };
}

export function applyAttendanceReward(
  state: GrowthState,
  actionDate: string,
  grantedAt: string
): RewardResult {
  const attendanceEventId = `attendance:${actionDate}`;

  if (state.rewardHistory[attendanceEventId] || state.attendanceHistory[actionDate]) {
    return withoutReward(state, 'already-rewarded');
  }

  const streakChange = calculateNextStreak(state.lastAttendanceDate, actionDate);
  const currentStreak = streakChange === null ? state.currentStreak + 1 : streakChange;
  const cycleDay = (Object.keys(state.attendanceHistory).length % 7) + 1;
  const basePoints = GROWTH_CONFIG.attendancePointCycle[cycleDay - 1];
  const streakStartDate = getStreakStartDate(actionDate, currentStreak);
  const milestone =
    currentStreak === 7 || currentStreak === 30
      ? GROWTH_CONFIG.attendanceMilestones[currentStreak]
      : null;
  const milestoneEventId = milestone
    ? `attendance-milestone:${currentStreak}:${streakStartDate}`
    : null;
  const shouldGrantMilestone =
    milestone !== null && milestoneEventId !== null && !state.rewardHistory[milestoneEventId];
  const exp = GROWTH_CONFIG.attendanceExp + (shouldGrantMilestone ? milestone.exp : 0);
  const points = basePoints + (shouldGrantMilestone ? milestone.points : 0);
  const attendanceEvent: RewardEvent = {
    actionDate,
    exp: GROWTH_CONFIG.attendanceExp,
    grantedAt,
    id: attendanceEventId,
    points: basePoints,
    targetDate: actionDate,
    type: 'attendance',
  };
  const nextRewardHistory: Record<string, RewardEvent> = {
    ...state.rewardHistory,
    [attendanceEventId]: attendanceEvent,
    ...(shouldGrantMilestone && milestoneEventId
      ? {
          [milestoneEventId]: {
          actionDate,
          exp: milestone.exp,
          grantedAt,
          id: milestoneEventId,
          points: milestone.points,
          targetDate: actionDate,
          type: 'attendance-milestone' as const,
        },
        }
      : {}),
  };
  const nextState: GrowthState = {
    ...state,
    attendanceHistory: {
      ...state.attendanceHistory,
      [actionDate]: { checkedAt: grantedAt, cycleDay, exp, points },
    },
    currentStreak,
    lastAttendanceDate: actionDate,
    longestStreak: Math.max(state.longestStreak, currentStreak),
    rewardHistory: nextRewardHistory,
    totalExp: state.totalExp + exp,
    totalPoints: state.totalPoints + points,
  };

  return {
    granted: true,
    grantedExp: exp,
    grantedPoints: points,
    reason: 'granted',
    state: nextState,
  };
}

function countRewardEvents(
  state: GrowthState,
  predicate: (event: RewardEvent) => boolean
) {
  return Object.values(state.rewardHistory).filter(predicate).length;
}

export function applyExpenseRecordReward(
  state: GrowthState,
  input: {
    actionDate: string;
    grantedAt: string;
    isFirstRecordOfDate: boolean;
    recordId: string;
    targetDate: string;
  }
): RewardResult {
  const eventId = `expense:${input.recordId}`;

  if (state.rewardHistory[eventId]) {
    return withoutReward(state, 'already-rewarded');
  }

  if (input.targetDate > input.actionDate) {
    return withoutReward(state, 'future-date');
  }

  if (input.targetDate < input.actionDate) {
    const pastRewardCount = countRewardEvents(
      state,
      (event) =>
        event.actionDate === input.actionDate &&
        (event.type === 'past-expense' || event.type === 'past-reflection')
    );

    if (pastRewardCount >= GROWTH_CONFIG.pastActionDailyCap) {
      return withoutReward(state, 'daily-cap');
    }

    return withReward(state, {
      actionDate: input.actionDate,
      exp: GROWTH_CONFIG.pastExpense.exp,
      grantedAt: input.grantedAt,
      id: eventId,
      points: GROWTH_CONFIG.pastExpense.points,
      sourceId: input.recordId,
      targetDate: input.targetDate,
      type: 'past-expense',
    });
  }

  const rewardedRecordsForDate = Object.values(state.rewardHistory).filter(
    (event) =>
      event.targetDate === input.targetDate &&
      (event.type === 'current-expense-first' || event.type === 'current-expense-additional')
  );
  const isFirstReward = input.isFirstRecordOfDate && rewardedRecordsForDate.length === 0;

  if (isFirstReward) {
    return withReward(state, {
      actionDate: input.actionDate,
      exp: GROWTH_CONFIG.currentDateFirstExpense.exp,
      grantedAt: input.grantedAt,
      id: eventId,
      points: GROWTH_CONFIG.currentDateFirstExpense.points,
      sourceId: input.recordId,
      targetDate: input.targetDate,
      type: 'current-expense-first',
    });
  }

  const additionalRewardCount = rewardedRecordsForDate.filter(
    (event) => event.type === 'current-expense-additional'
  ).length;

  if (additionalRewardCount >= GROWTH_CONFIG.currentDateAdditionalExpenseCap) {
    return withoutReward(state, 'daily-cap');
  }

  return withReward(state, {
    actionDate: input.actionDate,
    exp: GROWTH_CONFIG.currentDateAdditionalExpense.exp,
    grantedAt: input.grantedAt,
    id: eventId,
    points: GROWTH_CONFIG.currentDateAdditionalExpense.points,
    sourceId: input.recordId,
    targetDate: input.targetDate,
    type: 'current-expense-additional',
  });
}

export function applyDailyReflectionReward(
  state: GrowthState,
  input: { actionDate: string; grantedAt: string; targetDate: string }
): RewardResult {
  const eventId = `reflection:${input.targetDate}`;

  if (state.rewardHistory[eventId]) {
    return withoutReward(state, 'already-rewarded');
  }

  if (input.targetDate > input.actionDate) {
    return withoutReward(state, 'future-date');
  }

  if (input.targetDate < input.actionDate) {
    const pastRewardCount = countRewardEvents(
      state,
      (event) =>
        event.actionDate === input.actionDate &&
        (event.type === 'past-expense' || event.type === 'past-reflection')
    );

    if (pastRewardCount >= GROWTH_CONFIG.pastActionDailyCap) {
      return withoutReward(state, 'daily-cap');
    }

    return withReward(state, {
      actionDate: input.actionDate,
      exp: GROWTH_CONFIG.pastReflection.exp,
      grantedAt: input.grantedAt,
      id: eventId,
      points: GROWTH_CONFIG.pastReflection.points,
      targetDate: input.targetDate,
      type: 'past-reflection',
    });
  }

  return withReward(state, {
    actionDate: input.actionDate,
    exp: GROWTH_CONFIG.currentDateReflection.exp,
    grantedAt: input.grantedAt,
    id: eventId,
    points: GROWTH_CONFIG.currentDateReflection.points,
    targetDate: input.targetDate,
    type: 'current-reflection',
  });
}
