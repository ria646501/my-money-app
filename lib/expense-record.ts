export const CATEGORIES = ['식사', '카페', '쇼핑', '교통', '취미', '생활', '기타'] as const;
export const SATISFACTIONS = ['😫', '😕', '😐', '🙂', '😍'] as const;
export const RECORDS_STORAGE_KEY = '@my-money-app/expense-records';
export const DAILY_SATISFACTIONS_STORAGE_KEY = '@my-money-app/daily-satisfactions';

export type Category = (typeof CATEGORIES)[number];
export type Satisfaction = (typeof SATISFACTIONS)[number];
export type Period = 'AM' | 'PM';
export type DailySatisfactions = Record<string, Satisfaction>;

export type ExpenseRecord = {
  id: string;
  amount: number;
  category: Category;
  satisfaction: Satisfaction;
  memo: string;
  createdAt: string;
  occurredAt: string;
  localDate: string;
  timeZone: string;
};

export type StoredExpenseRecord = Omit<
  ExpenseRecord,
  'occurredAt' | 'localDate' | 'timeZone'
> & {
  occurredAt?: string;
  localDate?: string;
  timeZone?: string;
};

export type TimeSelection = {
  hour: number;
  minute: number;
  period: Period;
};

export function getDateKey(year: number, monthIndex: number, day: number) {
  const month = String(monthIndex + 1).padStart(2, '0');
  const date = String(day).padStart(2, '0');

  return `${year}-${month}-${date}`;
}

export function getLocalDateKey(date: Date) {
  return getDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getCurrentTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (error) {
    console.error('기기 시간대를 확인하지 못했습니다.', error);
    return 'UTC';
  }
}

export function migrateExpenseRecord(record: StoredExpenseRecord): ExpenseRecord {
  const createdDate = new Date(record.createdAt);
  const safeCreatedDate = Number.isNaN(createdDate.getTime()) ? new Date() : createdDate;

  return {
    ...record,
    occurredAt: record.occurredAt || record.createdAt,
    localDate: record.localDate || getLocalDateKey(safeCreatedDate),
    timeZone: record.timeZone || getCurrentTimeZone(),
  };
}

export function formatRecordTime(record: ExpenseRecord) {
  const occurredDate = new Date(record.occurredAt);

  try {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: record.timeZone,
    }).format(occurredDate);
  } catch (error) {
    console.error('기록 당시 시간대로 시각을 표시하지 못했습니다.', error);

    try {
      return new Intl.DateTimeFormat('ko-KR', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(occurredDate);
    } catch {
      return '시간 정보 없음';
    }
  }
}

export function getTimeSelection(date: Date, timeZone?: string): TimeSelection {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      ...(timeZone ? { timeZone } : {}),
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 12);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
    const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value.toUpperCase();

    return {
      hour,
      minute,
      period: dayPeriod?.startsWith('P') ? 'PM' : 'AM',
    };
  } catch {
    return { hour: 12, minute: 0, period: 'AM' };
  }
}

export function getRecordTimeSelection(record: ExpenseRecord) {
  return getTimeSelection(new Date(record.occurredAt), record.timeZone);
}

export function to24Hour(hour: number, period: Period) {
  return (hour % 12) + (period === 'PM' ? 12 : 0);
}

function getZonedDateParts(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZone,
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)])
    );

    return {
      year: values.year,
      month: values.month,
      day: values.day,
      hour: values.hour,
      minute: values.minute,
      second: values.second,
    };
  } catch {
    return null;
  }
}

export function createOccurredAt(
  localDate: string,
  hour: number,
  minute: number,
  timeZone: string
) {
  const [year, month, day] = localDate.split('-').map(Number);

  if (
    ![year, month, day, hour, minute].every(Number.isFinite) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidateTimestamp = targetAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidateParts = getZonedDateParts(new Date(candidateTimestamp), timeZone);

    if (candidateParts === null) {
      return null;
    }

    const candidateAsUtc = Date.UTC(
      candidateParts.year,
      candidateParts.month - 1,
      candidateParts.day,
      candidateParts.hour,
      candidateParts.minute,
      candidateParts.second
    );
    const difference = targetAsUtc - candidateAsUtc;

    if (difference === 0) {
      return new Date(candidateTimestamp).toISOString();
    }

    candidateTimestamp += difference;
  }

  return null;
}

export function createOccurredAtFromSelection(
  localDate: string,
  timeZone: string,
  selection: TimeSelection
) {
  return createOccurredAt(
    localDate,
    to24Hour(selection.hour, selection.period),
    selection.minute,
    timeZone
  );
}

export function formatTimeSelection(selection: TimeSelection) {
  return `${selection.period === 'AM' ? '오전' : '오후'} ${selection.hour}:${String(
    selection.minute
  ).padStart(2, '0')}`;
}
