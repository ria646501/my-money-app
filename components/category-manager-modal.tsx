import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandColors } from '@/constants/theme';
import {
  CATEGORY_ICON_OPTIONS,
  CategoryIconName,
  ExpenseCategory,
} from '@/lib/categories';

type CategoryManagerModalProps = {
  categories: ExpenseCategory[];
  onCategoriesChange: (categories: ExpenseCategory[]) => Promise<boolean>;
  onClose: () => void;
  visible: boolean;
};

const CATEGORY_ROW_HEIGHT = 58;

type DraggableCategoryRowProps = {
  category: ExpenseCategory;
  dragFromIndex: number | null;
  dragTargetIndex: number | null;
  index: number;
  itemCount: number;
  onDelete: (category: ExpenseCategory) => void;
  onDragActiveChange: (isActive: boolean) => void;
  onEdit: (category: ExpenseCategory) => void;
  onDragPreviewChange: (fromIndex: number | null, toIndex: number | null) => void;
  onMove: (fromIndex: number, toIndex: number) => Promise<void>;
};

function DraggableCategoryRow({
  category,
  dragFromIndex,
  dragTargetIndex,
  index,
  itemCount,
  onDelete,
  onDragActiveChange,
  onDragPreviewChange,
  onEdit,
  onMove,
}: DraggableCategoryRowProps) {
  const translateY = useState(() => new Animated.Value(0))[0];
  const previewOffset =
    dragFromIndex === null || dragTargetIndex === null || index === dragFromIndex
      ? 0
      : dragFromIndex < dragTargetIndex && index > dragFromIndex && index <= dragTargetIndex
        ? -CATEGORY_ROW_HEIGHT
        : dragFromIndex > dragTargetIndex && index < dragFromIndex && index >= dragTargetIndex
          ? CATEGORY_ROW_HEIGHT
          : 0;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => {
          onDragActiveChange(true);
          onDragPreviewChange(index, index);
          translateY.setValue(0);
        },
        onPanResponderMove: (_, gestureState) => {
          translateY.setValue(gestureState.dy);
          const targetIndex = Math.max(
            0,
            Math.min(itemCount - 1, index + Math.round(gestureState.dy / CATEGORY_ROW_HEIGHT))
          );
          onDragPreviewChange(index, targetIndex);
        },
        onPanResponderRelease: (_, gestureState) => {
          const targetIndex = Math.max(
            0,
            Math.min(itemCount - 1, index + Math.round(gestureState.dy / CATEGORY_ROW_HEIGHT))
          );

          void onMove(index, targetIndex).finally(() => {
            translateY.setValue(0);
            onDragPreviewChange(null, null);
            onDragActiveChange(false);
          });
        },
        onPanResponderTerminate: () => {
          translateY.setValue(0);
          onDragPreviewChange(null, null);
          onDragActiveChange(false);
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [
      index,
      itemCount,
      onDragActiveChange,
      onDragPreviewChange,
      onMove,
      translateY,
    ]
  );

  return (
    <Animated.View
      style={[
        styles.categoryRow,
        index === dragFromIndex && styles.categoryRowDragging,
        {
          transform: [
            { translateY: index === dragFromIndex ? translateY : previewOffset },
          ],
        },
      ]}>
      <View
        accessible
        accessibilityLabel={`${category.name} 순서 변경`}
        accessibilityHint="위아래로 드래그하세요"
        {...panResponder.panHandlers}
        style={styles.dragHandle}>
        <MaterialCommunityIcons color={BrandColors.textMuted} name="drag-vertical" size={23} />
      </View>
      <View style={styles.categoryIconCircle}>
        <MaterialCommunityIcons color={BrandColors.primary} name={category.icon} size={21} />
      </View>
      <Text numberOfLines={1} style={styles.categoryName}>
        {category.name}
      </Text>
      <Pressable onPress={() => onEdit(category)} style={styles.rowAction}>
        <Text style={styles.editText}>수정</Text>
      </Pressable>
      <Pressable onPress={() => onDelete(category)} style={styles.rowAction}>
        <Text style={styles.deleteText}>삭제</Text>
      </Pressable>
    </Animated.View>
  );
}

export function CategoryManagerModal({
  categories,
  onCategoriesChange,
  onClose,
  visible,
}: CategoryManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    fromIndex: number;
    targetIndex: number;
  } | null>(null);
  const [isListScrollEnabled, setIsListScrollEnabled] = useState(true);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<CategoryIconName>('tag-outline');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setIcon('tag-outline');
  };

  const handleClose = () => {
    setDragPreview(null);
    setIsListScrollEnabled(true);
    resetForm();
    onClose();
  };

  const handleDragActiveChange = useCallback((isActive: boolean) => {
    setIsListScrollEnabled(!isActive);
  }, []);

  const handleDragPreviewChange = useCallback(
    (fromIndex: number | null, targetIndex: number | null) => {
      if (fromIndex === null || targetIndex === null) {
        setDragPreview(null);
        return;
      }

      setDragPreview((currentPreview) =>
        currentPreview?.fromIndex === fromIndex && currentPreview.targetIndex === targetIndex
          ? currentPreview
          : { fromIndex, targetIndex }
      );
    },
    []
  );

  const startEditing = (category: ExpenseCategory) => {
    setEditingId(category.id);
    setName(category.name);
    setIcon(category.icon);
  };

  const moveCategory = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= categories.length ||
        toIndex >= categories.length
      ) {
        return;
      }

      const updatedCategories = [...categories];
      const [movedCategory] = updatedCategories.splice(fromIndex, 1);
      updatedCategories.splice(toIndex, 0, movedCategory);

      await onCategoriesChange(updatedCategories);
    },
    [categories, onCategoriesChange]
  );

  const saveCategory = async () => {
    const trimmedName = name.trim();

    if (trimmedName === '') {
      Alert.alert('카테고리 이름을 입력해 주세요');
      return;
    }

    const updatedCategories = editingId
      ? categories.map((category) =>
          category.id === editingId ? { ...category, name: trimmedName, icon } : category
        )
      : [
          ...categories,
          {
            id: `category-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: trimmedName,
            icon,
          },
        ];

    if (await onCategoriesChange(updatedCategories)) {
      resetForm();
    }
  };

  const deleteCategory = (category: ExpenseCategory) => {
    Alert.alert(
      `${category.name} 카테고리를 삭제할까요?`,
      '기존 소비 기록에는 기록 당시 카테고리가 그대로 남아요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const updatedCategories = categories.filter((item) => item.id !== category.id);

            if (await onCategoriesChange(updatedCategories)) {
              if (editingId === category.id) {
                resetForm();
              }
            }
          },
        },
      ]
    );
  };

  return (
    <Modal animationType="slide" onRequestClose={handleClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>카테고리 관리</Text>
                <Text style={styles.caption}>추가하거나 기존 항목을 수정할 수 있어요.</Text>
              </View>
              <Pressable accessibilityLabel="카테고리 관리 닫기" onPress={handleClose}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              scrollEnabled={isListScrollEnabled}
              showsVerticalScrollIndicator={false}>
              <View style={styles.categoryList}>
                {categories.map((category, index) => (
                  <DraggableCategoryRow
                    category={category}
                    dragFromIndex={dragPreview?.fromIndex ?? null}
                    dragTargetIndex={dragPreview?.targetIndex ?? null}
                    index={index}
                    itemCount={categories.length}
                    key={category.id}
                    onDelete={deleteCategory}
                    onDragActiveChange={handleDragActiveChange}
                    onDragPreviewChange={handleDragPreviewChange}
                    onEdit={startEditing}
                    onMove={moveCategory}
                  />
                ))}
                {categories.length === 0 ? (
                  <Text style={styles.emptyText}>사용 중인 카테고리가 없어요.</Text>
                ) : null}
              </View>

              <View style={styles.form}>
                <Text style={styles.formTitle}>
                  {editingId ? '카테고리 수정' : '새 카테고리 추가'}
                </Text>
                <TextInput
                  maxLength={20}
                  onChangeText={setName}
                  placeholder="카테고리 이름"
                  placeholderTextColor="#9B97A8"
                  style={styles.nameInput}
                  value={name}
                />
                <Text style={styles.iconLabel}>아이콘</Text>
                <View style={styles.iconGrid}>
                  {CATEGORY_ICON_OPTIONS.map((item) => {
                    const isSelected = icon === item;

                    return (
                      <Pressable
                        accessibilityState={{ selected: isSelected }}
                        key={item}
                        onPress={() => setIcon(item)}
                        style={[
                          styles.iconButton,
                          isSelected && styles.iconButtonSelected,
                        ]}>
                        <MaterialCommunityIcons
                          color={isSelected ? BrandColors.primary : '#858193'}
                          name={item}
                          size={22}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.formActions}>
                  {editingId ? (
                    <Pressable onPress={resetForm} style={styles.cancelButton}>
                      <Text style={styles.cancelText}>취소</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => void saveCategory()} style={styles.saveButton}>
                    <Text style={styles.saveText}>{editingId ? '수정 저장' : '추가하기'}</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  overlay: { backgroundColor: 'rgba(28, 24, 42, 0.35)', flex: 1, justifyContent: 'flex-end' },
  card: {
    backgroundColor: BrandColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 30,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: BrandColors.text, fontSize: 21, fontWeight: '800' },
  caption: { color: BrandColors.textMuted, fontSize: 12, marginTop: 4 },
  closeText: { color: BrandColors.textMuted, fontSize: 30, lineHeight: 32 },
  categoryList: { backgroundColor: BrandColors.surface, borderRadius: 16, paddingHorizontal: 12 },
  categoryRow: {
    alignItems: 'center',
    borderBottomColor: BrandColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
  },
  categoryRowDragging: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#2A203F',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    zIndex: 2,
  },
  categoryIconCircle: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  categoryName: { color: BrandColors.text, flex: 1, fontSize: 14, fontWeight: '700', marginLeft: 10 },
  dragHandle: { alignItems: 'center', height: 48, justifyContent: 'center', width: 30 },
  rowAction: { paddingHorizontal: 8, paddingVertical: 10 },
  editText: { color: BrandColors.primary, fontSize: 13, fontWeight: '700' },
  deleteText: { color: '#C05A5A', fontSize: 13, fontWeight: '700' },
  emptyText: { color: BrandColors.textMuted, paddingVertical: 22, textAlign: 'center' },
  form: { backgroundColor: BrandColors.surface, borderRadius: 16, marginTop: 14, padding: 14 },
  formTitle: { color: BrandColors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  nameInput: {
    backgroundColor: BrandColors.surfaceSoft,
    borderColor: BrandColors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: BrandColors.text,
    height: 46,
    paddingHorizontal: 12,
  },
  iconLabel: { color: BrandColors.text, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 14 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceSoft,
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconButtonSelected: { backgroundColor: BrandColors.primarySoft, borderColor: BrandColors.primary },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  cancelButton: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 48, width: 72 },
  cancelText: { color: BrandColors.textMuted, fontSize: 14, fontWeight: '700' },
  saveButton: { alignItems: 'center', backgroundColor: BrandColors.primary, borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 48 },
  saveText: { color: BrandColors.onPrimary, fontSize: 15, fontWeight: '800' },
});
