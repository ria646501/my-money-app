import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CATEGORIES_STORAGE_KEY,
  CATEGORY_CATALOG_VERSION_KEY,
  CURRENT_CATEGORY_CATALOG_VERSION,
  DEFAULT_CATEGORIES,
  ExpenseCategory,
  parseStoredCategories,
} from '@/lib/categories';
import {
  DAILY_SATISFACTIONS_STORAGE_KEY,
  DailySatisfactions,
  ExpenseRecord,
  getCurrentTimeZone,
  getLocalDateKey,
  RECORDS_STORAGE_KEY,
  Satisfaction,
} from '@/lib/expense-record';
import { GROWTH_CELEBRATION_STORAGE_KEY } from '@/lib/growth-celebration';
import { createInitialGrowthState, GROWTH_STORAGE_KEY, GrowthState } from '@/lib/growth';

export const DEMO_BACKUP_STORAGE_KEY = '@my-money-app/demo-backup-v1';
export const DEMO_SEED_GUARD_KEY = '@my-money-app/demo-seed-v1-complete';
export const DEMO_RESEED_GUARD_KEY = '@my-money-app/demo-seed-v2-complete';
export const DEMO_STATS_RESEED_GUARD_KEY = '@my-money-app/demo-seed-v3-complete';

const ACTIVE_DEMO_SEED_GUARD_KEY = DEMO_STATS_RESEED_GUARD_KEY;
const DEMO_SEED_REVISION = 3;

type DemoSeedOptions = {
  /** 웹 포트폴리오를 새로 열 때는 언제나 체험용 데이터를 다시 준비한다. */
  force?: boolean;
};

type DemoBackup = {
  createdAt: string;
  values: Record<string, string | null>;
  version: 1;
};

const BACKUP_SOURCE_KEYS = [
  CATEGORIES_STORAGE_KEY,
  CATEGORY_CATALOG_VERSION_KEY,
  DAILY_SATISFACTIONS_STORAGE_KEY,
  GROWTH_CELEBRATION_STORAGE_KEY,
  GROWTH_STORAGE_KEY,
  RECORDS_STORAGE_KEY,
] as const;

const DEMO_RECORD_TEMPLATES: {
  amount: number;
  categoryIndex: number;
  dayOfMonth: number;
  hour: number;
  memo: string;
  minute: number;
  satisfaction: Satisfaction;
}[] = [
  { amount: 8900, categoryIndex: 0, dayOfMonth: 1, hour: 12, memo: '점심 식사', minute: 20, satisfaction: '🙂' },
  { amount: 5400, categoryIndex: 1, dayOfMonth: 2, hour: 16, memo: '산책하며 마신 라떼', minute: 10, satisfaction: '😍' },
  { amount: 1550, categoryIndex: 4, dayOfMonth: 4, hour: 8, memo: '출근길 버스', minute: 5, satisfaction: '😐' },
  { amount: 18000, categoryIndex: 3, dayOfMonth: 5, hour: 19, memo: '보고 싶던 전시', minute: 30, satisfaction: '😍' },
  { amount: 12700, categoryIndex: 0, dayOfMonth: 7, hour: 18, memo: '친구와 저녁', minute: 45, satisfaction: '🙂' },
  { amount: 32000, categoryIndex: 2, dayOfMonth: 9, hour: 14, memo: '필요했던 셔츠', minute: 15, satisfaction: '🙂' },
  { amount: 4800, categoryIndex: 1, dayOfMonth: 11, hour: 11, memo: '작업하며 커피', minute: 40, satisfaction: '😐' },
  { amount: 24000, categoryIndex: 3, dayOfMonth: 13, hour: 20, memo: '주말 영화와 팝콘', minute: 0, satisfaction: '😍' },
  { amount: 9200, categoryIndex: 0, dayOfMonth: 15, hour: 12, memo: '간단한 점심', minute: 35, satisfaction: '😕' },
  { amount: 6900, categoryIndex: 5, dayOfMonth: 17, hour: 17, memo: '생활용품 보충', minute: 25, satisfaction: '😐' },
  { amount: 14800, categoryIndex: 3, dayOfMonth: 19, hour: 15, memo: '새 보드게임', minute: 50, satisfaction: '😍' },
  { amount: 4600, categoryIndex: 1, dayOfMonth: 21, hour: 13, memo: '디저트 한 조각', minute: 10, satisfaction: '🙂' },
];

function getSeedCategories(rawCategories: string | null) {
  if (rawCategories !== null) {
    try {
      const parsed = parseStoredCategories(JSON.parse(rawCategories));

      if (parsed !== null && parsed.length > 0) {
        return parsed;
      }
    } catch (error) {
      console.error('데모용 카테고리를 해석하지 못했습니다.', error);
    }
  }

  return DEFAULT_CATEGORIES;
}

function createDemoRecords(categories: ExpenseCategory[]) {
  const timeZone = getCurrentTimeZone();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthRecords = DEMO_RECORD_TEMPLATES.map((template, index): ExpenseRecord => {
    const occurredDate = new Date(
      currentYear,
      currentMonth,
      template.dayOfMonth,
      template.hour,
      template.minute,
      0,
      0
    );
    const category = categories[template.categoryIndex % categories.length];
    const localDate = getLocalDateKey(occurredDate);

    return {
      amount: template.amount,
      category: category.name,
      categoryIcon: category.icon,
      categoryId: category.id,
      createdAt: occurredDate.toISOString(),
      id: `demo-v3-${localDate}-${index}`,
      localDate,
      memo: template.memo,
      occurredAt: occurredDate.toISOString(),
      satisfaction: template.satisfaction,
      timeZone,
    };
  });

  const todayRecords: ExpenseRecord[] = [
    { amount: 6200, categoryIndex: 1, memo: '오전 커피', satisfaction: '🙂' },
    { amount: 13500, categoryIndex: 0, memo: '오늘의 점심', satisfaction: '😍' },
  ].map((template, index) => {
    const occurredDate = new Date(currentYear, currentMonth, now.getDate(), 11 + index, index ? 35 : 10, 0, 0);
    const category = categories[template.categoryIndex % categories.length];
    const localDate = getLocalDateKey(occurredDate);

    return {
      amount: template.amount,
      category: category.name,
      categoryIcon: category.icon,
      categoryId: category.id,
      createdAt: occurredDate.toISOString(),
      id: `demo-v3-today-${localDate}-${index}`,
      localDate,
      memo: template.memo,
      occurredAt: occurredDate.toISOString(),
      satisfaction: template.satisfaction,
      timeZone,
    };
  });

  return [...monthRecords, ...todayRecords];
}

function createDemoDailySatisfactions(records: ExpenseRecord[]): DailySatisfactions {
  const dailyValues: Satisfaction[] = [
    '😍',
    '😍',
    '🙂',
    '😍',
    '😐',
    '😍',
    '😕',
    '😍',
    '😍',
    '🙂',
    '😍',
    '😐',
  ];
  const dateKeys = [...new Set(records.map((record) => record.localDate))];

  return dateKeys.reduce<DailySatisfactions>(
    (dailySatisfactions, dateKey, index) => {
      dailySatisfactions[dateKey] = dailyValues[index];
      return dailySatisfactions;
    },
    {}
  );
}

export async function ensurePortfolioDemoSeed(options: DemoSeedOptions = {}) {
  const existingGuard = await AsyncStorage.getItem(ACTIVE_DEMO_SEED_GUARD_KEY);

  if (!options.force && existingGuard !== null) {
    return false;
  }

  const storedEntries = await AsyncStorage.multiGet([...BACKUP_SOURCE_KEYS]);
  const storedValues = Object.fromEntries(storedEntries) as Record<string, string | null>;
  const existingBackup = await AsyncStorage.getItem(DEMO_BACKUP_STORAGE_KEY);

  if (existingBackup === null) {
    const backup: DemoBackup = {
      createdAt: new Date().toISOString(),
      values: storedValues,
      version: 1,
    };

    await AsyncStorage.setItem(DEMO_BACKUP_STORAGE_KEY, JSON.stringify(backup));
  }

  const categories = getSeedCategories(storedValues[CATEGORIES_STORAGE_KEY]);
  const records = createDemoRecords(categories);
  const dailySatisfactions = createDemoDailySatisfactions(records);
  const growthState: GrowthState = {
    ...createInitialGrowthState(),
    // 방문자가 출석 보상을 받으며 알에서 삐약이로 성장하는 순간을 체험한다.
    totalExp: 75,
    totalPoints: 38,
  };

  await AsyncStorage.multiSet([
    [CATEGORIES_STORAGE_KEY, JSON.stringify(categories)],
    [
      CATEGORY_CATALOG_VERSION_KEY,
      storedValues[CATEGORY_CATALOG_VERSION_KEY] ?? CURRENT_CATEGORY_CATALOG_VERSION,
    ],
    [RECORDS_STORAGE_KEY, JSON.stringify(records)],
    [DAILY_SATISFACTIONS_STORAGE_KEY, JSON.stringify(dailySatisfactions)],
    [GROWTH_STORAGE_KEY, JSON.stringify(growthState)],
    [
      GROWTH_CELEBRATION_STORAGE_KEY,
      JSON.stringify({ pending: null, shownStageIds: [], version: 1 }),
    ],
  ]);
  await AsyncStorage.setItem(
    ACTIVE_DEMO_SEED_GUARD_KEY,
    JSON.stringify({ completedAt: new Date().toISOString(), version: DEMO_SEED_REVISION })
  );

  return true;
}

export async function restorePortfolioDemoBackup() {
  const storedBackup = await AsyncStorage.getItem(DEMO_BACKUP_STORAGE_KEY);

  if (storedBackup === null) {
    return false;
  }

  const parsedBackup: unknown = JSON.parse(storedBackup);

  if (
    typeof parsedBackup !== 'object' ||
    parsedBackup === null ||
    !('version' in parsedBackup) ||
    parsedBackup.version !== 1 ||
    !('values' in parsedBackup) ||
    typeof parsedBackup.values !== 'object' ||
    parsedBackup.values === null
  ) {
    throw new Error('데모 백업 형식이 올바르지 않습니다.');
  }

  const values = parsedBackup.values as Record<string, unknown>;
  const entriesToRestore: [string, string][] = [];
  const keysToRemove: string[] = [];

  BACKUP_SOURCE_KEYS.forEach((key) => {
    const value = values[key];

    if (typeof value === 'string') {
      entriesToRestore.push([key, value]);
    } else {
      keysToRemove.push(key);
    }
  });

  if (entriesToRestore.length > 0) {
    await AsyncStorage.multiSet(entriesToRestore);
  }

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }

  await AsyncStorage.setItem(
    ACTIVE_DEMO_SEED_GUARD_KEY,
    JSON.stringify({ restoredAt: new Date().toISOString(), version: DEMO_SEED_REVISION })
  );
  return true;
}
