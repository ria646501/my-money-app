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
