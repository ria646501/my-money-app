export const CATEGORIES_STORAGE_KEY = '@my-money-app/categories';
export const CATEGORY_CATALOG_VERSION_KEY = '@my-money-app/category-catalog-version';
export const CURRENT_CATEGORY_CATALOG_VERSION = '3';

export const CATEGORY_ICON_OPTIONS = [
  'silverware-fork-knife',
  'coffee-outline',
  'shopping-outline',
  'gamepad-variant-outline',
  'bus',
  'lipstick',
  'package-variant-closed',
  'gift-outline',
  'medical-bag',
  'tshirt-crew-outline',
  'home-outline',
  'paw-outline',
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number];

export type ExpenseCategory = {
  id: string;
  name: string;
  icon: CategoryIconName;
};

export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: 'default-meal', name: '식비', icon: 'silverware-fork-knife' },
  { id: 'default-cafe', name: '카페/디저트', icon: 'coffee-outline' },
  { id: 'default-shopping', name: '쇼핑', icon: 'shopping-outline' },
  { id: 'default-hobby', name: '문화/여가', icon: 'gamepad-variant-outline' },
  { id: 'default-transport', name: '교통', icon: 'bus' },
  { id: 'default-other', name: '기타', icon: 'package-variant-closed' },
];

const LEGACY_DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: 'default-beauty', name: '뷰티/미용', icon: 'lipstick' },
  { id: 'default-household', name: '생활용품', icon: 'package-variant-closed' },
  { id: 'default-gift', name: '선물', icon: 'gift-outline' },
  { id: 'default-health', name: '의료/건강', icon: 'medical-bag' },
  { id: 'default-fashion', name: '패션/의류', icon: 'tshirt-crew-outline' },
  { id: 'default-living', name: '주거/생활비', icon: 'home-outline' },
  { id: 'default-pet', name: '반려동물', icon: 'paw-outline' },
];

const HOME_HIDDEN_LEGACY_DEFAULT_IDS = new Set(
  LEGACY_DEFAULT_CATEGORIES.map((category) => category.id)
);

const VALID_ICONS = new Set<string>(CATEGORY_ICON_OPTIONS);
const LEGACY_ICON_ALIASES: Record<string, CategoryIconName> = {
  'book-open-page-variant-outline': 'gamepad-variant-outline',
  'dots-horizontal': 'package-variant-closed',
  'heart-outline': 'gift-outline',
  'music-note': 'gamepad-variant-outline',
  'tag-outline': 'package-variant-closed',
  airplane: 'bus',
  run: 'medical-bag',
};

export function normalizeCategoryIcon(value: unknown): CategoryIconName {
  if (typeof value !== 'string') {
    return 'package-variant-closed';
  }

  if (VALID_ICONS.has(value)) {
    return value as CategoryIconName;
  }

  return LEGACY_ICON_ALIASES[value] ?? 'package-variant-closed';
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

export function getHomeSelectableCategories(categories: ExpenseCategory[]) {
  return categories.filter(
    (category) => !HOME_HIDDEN_LEGACY_DEFAULT_IDS.has(category.id)
  );
}

export function getDefaultCategoryByName(name: string) {
  const legacyNameAliases: Record<string, string> = {
    식사: 'default-meal',
    카페: 'default-cafe',
    취미: 'default-hobby',
    생활: 'default-living',
  };
  const categoryId = legacyNameAliases[name];

  return (
    [...DEFAULT_CATEGORIES, ...LEGACY_DEFAULT_CATEGORIES].find(
      (category) => category.name === name || category.id === categoryId
    ) ?? null
  );
}

export function createLegacyCategoryId(name: string) {
  const encodedName = Array.from(name)
    .map((character) => character.codePointAt(0)?.toString(36) ?? '')
    .join('-');

  return `legacy-${encodedName || 'unknown'}`;
}
