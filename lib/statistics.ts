import { SATISFACTIONS } from '@/lib/expense-record';
import type {
  DailySatisfactions,
  ExpenseRecord,
  Satisfaction,
} from '@/lib/expense-record';

export type CategoryBreakdownItem = {
  amount: number;
  categoryId: string;
  categoryName: string;
  isAggregated: boolean;
  percentage: number;
};

export type MonthChange = {
  amountDifference: number;
  percentage: number;
};

export type SatisfactionBreakdownItem = {
  count: number;
  percentage: number;
  satisfaction: Satisfaction;
};

export type CategorySatisfactionRankingItem = {
  averageSatisfaction: number;
  categoryIcon: ExpenseRecord['categoryIcon'];
  categoryId: string;
  categoryName: string;
  recordCount: number;
  totalAmount: number;
};

// This score exists only for statistics presentation. Stored satisfaction values never change.
const SATISFACTION_SCORE: Record<Satisfaction, number> = {
  '😫': 1,
  '😕': 2,
  '😐': 3,
  '🙂': 4,
  '😍': 5,
};

export function getMonthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function getMonthlyExpenses(
  records: ExpenseRecord[],
  year: number,
  monthIndex: number
) {
  const monthPrefix = `${getMonthKey(year, monthIndex)}-`;
  return records.filter((record) => record.localDate.startsWith(monthPrefix));
}

export function getMonthlyTotal(records: ExpenseRecord[]) {
  return records.reduce((total, record) => total + record.amount, 0);
}

export function getPreviousMonth(year: number, monthIndex: number) {
  const previousMonth = new Date(year, monthIndex - 1, 1);
  return {
    monthIndex: previousMonth.getMonth(),
    year: previousMonth.getFullYear(),
  };
}

export function getMonthChange(
  currentMonthTotal: number,
  previousMonthTotal: number
): MonthChange | null {
  if (previousMonthTotal <= 0) {
    return null;
  }

  return {
    amountDifference: currentMonthTotal - previousMonthTotal,
    percentage: ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100,
  };
}

function assignWholePercentages(
  items: Omit<CategoryBreakdownItem, 'percentage'>[],
  total: number
) {
  const percentages = items.map((item, index) => {
    const exactPercentage = total > 0 ? (item.amount / total) * 100 : 0;
    return {
      floorPercentage: Math.floor(exactPercentage),
      fraction: exactPercentage - Math.floor(exactPercentage),
      index,
    };
  });
  let remainingPercentage = 100 - percentages.reduce(
    (sum, item) => sum + item.floorPercentage,
    0
  );

  percentages
    .slice()
    .sort((first, second) => second.fraction - first.fraction)
    .forEach((item) => {
      if (remainingPercentage > 0) {
        percentages[item.index].floorPercentage += 1;
        remainingPercentage -= 1;
      }
    });

  return items.map((item, index) => ({
    ...item,
    percentage: percentages[index].floorPercentage,
  }));
}

export function getCategoryBreakdown(
  records: ExpenseRecord[],
  maxVisibleCategories = 6
): CategoryBreakdownItem[] {
  const total = getMonthlyTotal(records);

  if (total <= 0 || maxVisibleCategories < 1) {
    return [];
  }

  const groupedCategories = new Map<
    string,
    Omit<CategoryBreakdownItem, 'percentage'>
  >();

  records.forEach((record) => {
    const existingCategory = groupedCategories.get(record.categoryId);

    if (existingCategory) {
      existingCategory.amount += record.amount;
      return;
    }

    groupedCategories.set(record.categoryId, {
      amount: record.amount,
      categoryId: record.categoryId,
      categoryName: record.category,
      isAggregated: false,
    });
  });

  const sortedCategories = Array.from(groupedCategories.values()).sort(
    (first, second) => second.amount - first.amount
  );
  const visibleCategories =
    sortedCategories.length <= maxVisibleCategories
      ? sortedCategories
      : [
          ...sortedCategories.slice(0, maxVisibleCategories - 1),
          {
            amount: sortedCategories
              .slice(maxVisibleCategories - 1)
              .reduce((sum, item) => sum + item.amount, 0),
            categoryId: '__statistics_other__',
            categoryName: '기타 묶음',
            isAggregated: true,
          },
        ];

  return assignWholePercentages(visibleCategories, total);
}

export function getSatisfactionBreakdown(
  records: ExpenseRecord[]
): SatisfactionBreakdownItem[] {
  if (records.length === 0) {
    return [];
  }

  const counts = new Map<Satisfaction, number>();
  records.forEach((record) => {
    counts.set(record.satisfaction, (counts.get(record.satisfaction) ?? 0) + 1);
  });

  const items = SATISFACTIONS.map((satisfaction, order) => {
      const count = counts.get(satisfaction) ?? 0;
      const exactPercentage = (count / records.length) * 100;
      return {
        count,
        exactPercentage,
        floorPercentage: Math.floor(exactPercentage),
        order,
        satisfaction,
      };
    });
  let remaining = 100 - items.reduce((sum, item) => sum + item.floorPercentage, 0);

  items
    .slice()
    .sort(
      (first, second) =>
        second.exactPercentage - second.floorPercentage -
          (first.exactPercentage - first.floorPercentage) || first.order - second.order
    )
    .forEach((item) => {
      if (remaining > 0) {
        item.floorPercentage += 1;
        remaining -= 1;
      }
    });

  return items
    .map(({ count, floorPercentage, order, satisfaction }) => ({
      count,
      order,
      percentage: floorPercentage,
      satisfaction,
    }))
    .filter((item) => item.count > 0)
    .sort((first, second) => second.count - first.count || first.order - second.order)
    .map(({ count, percentage, satisfaction }) => ({ count, percentage, satisfaction }));
}

export function getMonthlyDailySatisfactionBreakdown(
  dailySatisfactions: DailySatisfactions,
  year: number,
  monthIndex: number
): SatisfactionBreakdownItem[] {
  const monthlySatisfactions = Object.values(
    getMonthlyDailySatisfactions(dailySatisfactions, year, monthIndex)
  );

  if (monthlySatisfactions.length === 0) {
    return [];
  }

  const counts = new Map<Satisfaction, number>();
  monthlySatisfactions.forEach((satisfaction) => {
    counts.set(satisfaction, (counts.get(satisfaction) ?? 0) + 1);
  });

  const items = SATISFACTIONS.map((satisfaction, order) => {
    const count = counts.get(satisfaction) ?? 0;
    const exactPercentage = (count / monthlySatisfactions.length) * 100;

    return {
      count,
      exactPercentage,
      floorPercentage: Math.floor(exactPercentage),
      order,
      satisfaction,
    };
  });
  let remaining = 100 - items.reduce((sum, item) => sum + item.floorPercentage, 0);

  items
    .slice()
    .sort(
      (first, second) =>
        second.exactPercentage - second.floorPercentage -
          (first.exactPercentage - first.floorPercentage) || first.order - second.order
    )
    .forEach((item) => {
      if (remaining > 0) {
        item.floorPercentage += 1;
        remaining -= 1;
      }
    });

  return items
    .map(({ count, floorPercentage, order, satisfaction }) => ({
      count,
      order,
      percentage: floorPercentage,
      satisfaction,
    }))
    .filter((item) => item.count > 0)
    .sort((first, second) => second.count - first.count || first.order - second.order)
    .map(({ count, percentage, satisfaction }) => ({ count, percentage, satisfaction }));
}

export function getCategorySatisfactionRanking(
  records: ExpenseRecord[],
  limit = 3
): CategorySatisfactionRankingItem[] {
  if (limit < 1) {
    return [];
  }

  const grouped = new Map<
    string,
    Omit<CategorySatisfactionRankingItem, 'averageSatisfaction'> & {
      satisfactionTotal: number;
    }
  >();

  records.forEach((record) => {
    const existing = grouped.get(record.categoryId);

    if (existing) {
      existing.recordCount += 1;
      existing.satisfactionTotal += SATISFACTION_SCORE[record.satisfaction];
      existing.totalAmount += record.amount;
      return;
    }

    grouped.set(record.categoryId, {
      categoryIcon: record.categoryIcon,
      categoryId: record.categoryId,
      categoryName: record.category,
      recordCount: 1,
      satisfactionTotal: SATISFACTION_SCORE[record.satisfaction],
      totalAmount: record.amount,
    });
  });

  return Array.from(grouped.values())
    .map(({ satisfactionTotal, ...item }) => ({
      ...item,
      averageSatisfaction: satisfactionTotal / item.recordCount,
    }))
    .sort(
      (first, second) =>
        second.averageSatisfaction - first.averageSatisfaction ||
        second.recordCount - first.recordCount ||
        second.totalAmount - first.totalAmount ||
        first.categoryName.localeCompare(second.categoryName, 'ko-KR')
    )
    .slice(0, limit);
}

export function getMonthlyDailySatisfactions(
  dailySatisfactions: DailySatisfactions,
  year: number,
  monthIndex: number
) {
  const monthPrefix = `${getMonthKey(year, monthIndex)}-`;

  return Object.entries(dailySatisfactions).reduce<Record<string, Satisfaction>>(
    (monthlySatisfactions, [dateKey, satisfaction]) => {
      if (dateKey.startsWith(monthPrefix)) {
        monthlySatisfactions[dateKey] = satisfaction;
      }

      return monthlySatisfactions;
    },
    {}
  );
}
