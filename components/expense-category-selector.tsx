import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { CategoryIconImage, PRIMARY_CATEGORY_ICON_SIZE } from '@/components/category-icon-image';
import { ExpenseCategory } from '@/lib/categories';

type ExpenseCategorySelectorProps = {
  categories: ExpenseCategory[];
  onManageCategories?: () => void;
  onSelect: (categoryId: string) => void;
  selectedCategoryId: string | null;
};

export function ExpenseCategorySelector({
  categories,
  onManageCategories,
  onSelect,
  selectedCategoryId,
}: ExpenseCategorySelectorProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}>
      {categories.map((item) => {
        const isSelected = selectedCategoryId === item.id;

        return (
          <Pressable
            accessibilityLabel={item.name}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              styles.card,
              isSelected && styles.cardSelected,
              pressed && styles.pressed,
            ]}>
            <CategoryIconImage icon={item.icon} size={PRIMARY_CATEGORY_ICON_SIZE} />
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
          </Pressable>
        );
      })}

      {onManageCategories ? (
        <Pressable
          accessibilityLabel="카테고리 추가 및 관리"
          accessibilityRole="button"
          onPress={onManageCategories}
          style={({ pressed }) => [styles.card, styles.manageCard, pressed && styles.pressed]}>
          <MaterialCommunityIcons color="#8566DC" name="plus" size={23} />
          <Text numberOfLines={1} style={[styles.name, styles.manageName]}>추가</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 1, paddingRight: 4 },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFF7F8',
    borderColor: '#EEDDE5',
    borderRadius: 12,
    borderWidth: 1,
    height: 70,
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 2,
    width: 70,
  },
  cardSelected: { backgroundColor: '#FFF0F6', borderColor: '#FF75AB', borderWidth: 1.5 },
  manageCard: { borderColor: '#E4D7FD' },
  name: {
    color: '#8F849C',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  manageName: { color: '#8566DC' },
  pressed: { opacity: 0.72 },
});
