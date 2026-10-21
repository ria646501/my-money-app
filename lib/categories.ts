export const CATEGORIES_STORAGE_KEY = '@my-money-app/categories';

export const CATEGORY_ICON_OPTIONS = [
  'silverware-fork-knife',
  'coffee-outline',
  'shopping-outline',
  'bus',
  'gamepad-variant-outline',
  'home-outline',
  'dots-horizontal',
  'heart-outline',
  'gift-outline',
  'book-open-page-variant-outline',
  'run',
  'medical-bag',
  'paw-outline',
  'airplane',
  'music-note',
  'tag-outline',
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number];

export type ExpenseCategory = {
  id: string;
  name: string;
  icon: CategoryIconName;
};

export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: 'default-meal', name: '식사', icon: 'silverware-fork-knife' },
  { id: 'default-cafe', name: '카페', icon: 'coffee-outline' },
  { id: 'default-shopping', name: '쇼핑', icon: 'shopping-outline' },
  { id: 'default-transport', name: '교통', icon: 'bus' },
  { id: 'default-hobby', name: '취미', icon: 'gamepad-variant-outline' },
  { id: 'default-living', name: '생활', icon: 'home-outline' },
  { id: 'default-other', name: '기타', icon: 'dots-horizontal' },
];

const VALID_ICONS = new Set<string>(CATEGORY_ICON_OPTIONS);

export function normalizeCategoryIcon(value: unknown): CategoryIconName {
  return typeof value === 'string' && VALID_ICONS.has(value)
    ? (value as CategoryIconName)
    : 'tag-outline';
}

export function parseStoredCategories(value: unknown): ExpenseCategory[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const categories = value.flatMap((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      item.id.trim() === '' ||
      item.name.trim() === ''
    ) {
      return [];
    }

    return [
      {
        id: item.id,
        name: item.name.trim(),
        icon: normalizeCategoryIcon(item.icon),
      },
    ];
  });

  return categories;
}

export function getDefaultCategoryByName(name: string) {
  return DEFAULT_CATEGORIES.find((category) => category.name === name) ?? null;
}

export function createLegacyCategoryId(name: string) {
  const encodedName = Array.from(name)
    .map((character) => character.codePointAt(0)?.toString(36) ?? '')
    .join('-');

  return `legacy-${encodedName || 'unknown'}`;
}
