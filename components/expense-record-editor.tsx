import { useEffect, useMemo, useRef, useState } from 'react';
import {
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

import { TimeWheelPicker } from '@/components/time-wheel-picker';
import {
  CategoryIconImage,
  PRIMARY_CATEGORY_ICON_SIZE,
} from '@/components/category-icon-image';
import {
  PRIMARY_SATISFACTION_ICON_SIZE,
  SatisfactionIconImage,
} from '@/components/satisfaction-icon-image';
import { ExpenseCategory } from '@/lib/categories';
import {
  ExpenseRecord,
  getRecordTimeSelection,
  SATISFACTIONS,
  Satisfaction,
  TimeSelection,
} from '@/lib/expense-record';

const SATISFACTION_BACKGROUNDS: Record<Satisfaction, string> = {
  '😫': '#EAF3FF',
  '😕': '#FFF0F7',
  '😐': '#FFF9DE',
  '🙂': '#FFF1E6',
  '😍': '#FFEAF4',
};

const MEMO_MAX_LENGTH = 100;

export type ExpenseEditValues = {
  amount: number;
  category: ExpenseCategory;
  satisfaction: Satisfaction;
  memo: string;
  time: TimeSelection;
};

type ExpenseRecordEditorProps = {
  categories: ExpenseCategory[];
  record: ExpenseRecord | null;
  onClose: () => void;
  onDelete: (record: ExpenseRecord) => void;
  onSave: (record: ExpenseRecord, values: ExpenseEditValues) => void | Promise<void>;
};

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function ExpenseRecordEditor({
  categories,
  record,
  onClose,
  onDelete,
  onSave,
}: ExpenseRecordEditorProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [sheetTranslateY] = useState(() => new Animated.Value(0));
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [memo, setMemo] = useState('');
  const [time, setTime] = useState<TimeSelection>({ hour: 12, minute: 0, period: 'AM' });

  useEffect(() => {
    if (record === null) {
      return;
    }

    // The editor intentionally resets its local form when a different record is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmount(String(record.amount));
    setCategoryId(record.categoryId);
    setSatisfaction(record.satisfaction);
    setMemo(record.memo);
    setTime(getRecordTimeSelection(record));
  }, [record]);

  const recordCategory: ExpenseCategory | null = record
    ? { id: record.categoryId, name: record.category, icon: record.categoryIcon }
    : null;
  const categoryOptions =
    recordCategory && !categories.some((item) => item.id === recordCategory.id)
      ? [recordCategory, ...categories]
      : categories;
  const selectedCategory =
    categoryOptions.find((item) => item.id === categoryId) ?? null;
  const canSave = Number(amount) > 0 && selectedCategory !== null && satisfaction !== null;
  const dragResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
        onPanResponderMove: (_, gestureState) => {
          sheetTranslateY.setValue(Math.max(0, gestureState.dy));
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldClose =
            gestureState.dy >= 90 || (gestureState.dy >= 35 && gestureState.vy >= 0.9);

          if (shouldClose) {
            Animated.timing(sheetTranslateY, {
              duration: 180,
              toValue: 420,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) {
                onClose();
                sheetTranslateY.setValue(0);
              }
            });
            return;
          }

          Animated.spring(sheetTranslateY, {
            bounciness: 0,
            speed: 22,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(sheetTranslateY, {
            bounciness: 0,
            speed: 22,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onClose, sheetTranslateY]
  );

  const handleSave = () => {
    if (record === null || !canSave || selectedCategory === null || satisfaction === null) {
      return;
    }

    void onSave(record, {
      amount: Number(amount),
      category: selectedCategory,
      satisfaction,
      memo: memo.trim(),
      time,
    });
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={record !== null}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.card, { transform: [{ translateY: sheetTranslateY }] }]}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              ref={scrollRef}
              showsVerticalScrollIndicator={false}>
              <View {...dragResponder.panHandlers} style={styles.dragRegion}>
                <View style={styles.sheetHandle} />
                <View style={styles.header}>
                  <View>
                    <Text style={styles.title}>소비 기록 수정</Text>
                    {record ? (
                      <View style={styles.datePill}>
                        <Text style={styles.date}>
                          {formatDate(record.localDate)} · {record.timeZone}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityLabel="수정 닫기"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={onClose}
                    style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                    <Text style={styles.closeText}>×</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>금액</Text>
                <View style={styles.amountInputContainer}>
                  <Text pointerEvents="none" style={styles.wonPrefix}>₩</Text>
                  <TextInput
                    accessibilityLabel="수정할 소비 금액"
                    keyboardType="number-pad"
                    maxLength={10}
                    onChangeText={(value) => setAmount(value.replace(/[^0-9]/g, ''))}
                    style={styles.amountInput}
                    value={amount}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>카테고리</Text>
                <View style={styles.optionGrid}>
                  {categoryOptions.map((item) => {
                    const isSelected = categoryId === item.id;

                    return (
                      <Pressable
                        accessibilityLabel={item.name}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={item.id}
                        onPress={() => setCategoryId(item.id)}
                        style={({ pressed }) => [
                          styles.categoryButton,
                          isSelected && styles.categoryButtonSelected,
                          pressed && styles.pressed,
                        ]}>
                        <CategoryIconImage
                          icon={item.icon}
                          size={PRIMARY_CATEGORY_ICON_SIZE}
                        />
                        <Text
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                          numberOfLines={1}
                          style={styles.categoryName}>
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>이 소비는 어땠어?</Text>
                <View style={styles.satisfactionRow}>
                  {SATISFACTIONS.map((item) => {
                    const isSelected = satisfaction === item;

                    return (
                      <Pressable
                        accessibilityLabel={`수정할 만족도 ${item}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={item}
                        onPress={() => setSatisfaction(item)}
                        style={({ pressed }) => [
                          styles.satisfactionButton,
                          { backgroundColor: SATISFACTION_BACKGROUNDS[item] },
                          isSelected && styles.satisfactionButtonSelected,
                          pressed && styles.pressed,
                        ]}>
                        <SatisfactionIconImage
                          satisfaction={item}
                          size={PRIMARY_SATISFACTION_ICON_SIZE}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>메모 (선택)</Text>
                <View style={styles.memoContainer}>
                  <TextInput
                    accessibilityLabel="수정할 소비 메모"
                    maxLength={MEMO_MAX_LENGTH}
                    onChangeText={setMemo}
                    multiline
                    placeholder="예) 친구랑 게임~!"
                    placeholderTextColor="#9CA3AF"
                    style={styles.memoInput}
                    value={memo}
                  />
                  <Text pointerEvents="none" style={styles.memoCounter}>
                    {memo.length}/{MEMO_MAX_LENGTH}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>소비 시간</Text>
                <TimeWheelPicker
                  accentColor="#F778AB"
                  highlightColor="#FFF0F6"
                  onChange={setTime}
                  onGestureActiveChange={(isActive) => {
                    scrollRef.current?.setNativeProps({ scrollEnabled: !isActive });
                  }}
                  value={time}
                />
              </View>

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => record && onDelete(record)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                  <Text style={styles.deleteButtonText}>삭제</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSave }}
                  disabled={!canSave}
                  onPress={handleSave}
                  style={({ pressed }) => [
                    styles.saveButton,
                    !canSave && styles.saveButtonDisabled,
                    pressed && canSave && styles.saveButtonPressed,
                  ]}>
                  <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>
                    저장하기
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  overlay: {
    backgroundColor: 'rgba(43, 39, 63, 0.38)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFCF8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '94%',
    overflow: 'hidden',
  },
  content: { paddingBottom: 28, paddingHorizontal: 20, paddingTop: 10 },
  dragRegion: { marginHorizontal: -20, paddingHorizontal: 20 },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#E8DCE4',
    borderRadius: 3,
    height: 5,
    marginBottom: 16,
    width: 48,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomColor: '#F7CEDD',
    borderBottomWidth: 1,
    marginHorizontal: -20,
    marginBottom: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  title: { color: '#302D55', fontSize: 21, fontWeight: '900' },
  datePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1E8FF',
    borderRadius: 13,
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  date: { color: '#8C7EA6', fontSize: 12, fontWeight: '600' },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#F3EBFF',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  closeText: { color: '#81789A', fontSize: 29, fontWeight: '300', lineHeight: 31 },
  section: { gap: 8, marginBottom: 16 },
  label: { color: '#302D55', fontSize: 15, fontWeight: '800' },
  amountInputContainer: {
    alignItems: 'center',
    backgroundColor: '#F6EFFF',
    borderColor: '#E2D1FF',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: 14,
  },
  amountInput: { color: '#302D55', flex: 1, fontSize: 28, fontWeight: '900', lineHeight: 34, paddingVertical: 0 },
  wonPrefix: { color: '#D68BAA', fontSize: 26, fontWeight: '800', lineHeight: 34, marginRight: 7 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  categoryButton: {
    alignItems: 'center',
    backgroundColor: '#FFF7F8',
    borderColor: '#EEDDE5',
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: '19.7%',
    justifyContent: 'center',
    height: 70,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  categoryButtonSelected: { backgroundColor: '#FFF0F6', borderColor: '#FF75AB' },
  categoryName: {
    color: '#8F849C',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  satisfactionRow: { flexDirection: 'row', gap: 1 },
  satisfactionButton: {
    alignItems: 'center',
    borderColor: '#EEDDE5',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 70,
    justifyContent: 'center',
  },
  satisfactionButtonSelected: {
    backgroundColor: '#FFF0F6',
    borderColor: '#FF75AB',
    borderWidth: 1.5,
  },
  memoContainer: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EEDDE5',
    borderRadius: 11,
    borderWidth: 1,
    height: 78,
    overflow: 'hidden',
    position: 'relative',
  },
  memoInput: {
    color: '#302D55',
    fontSize: 14,
    height: '100%',
    paddingBottom: 25,
    paddingHorizontal: 12,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  memoCounter: { bottom: 8, color: '#9C92AA', fontSize: 10, position: 'absolute', right: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#EF9AA4',
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    flex: 1,
  },
  deleteButtonText: { color: '#D64F61', fontSize: 16, fontWeight: '800' },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#F778AB',
    borderRadius: 13,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  saveButtonDisabled: { backgroundColor: '#E5E8E2' },
  saveButtonPressed: { backgroundColor: '#E85C96' },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  saveButtonTextDisabled: { color: '#9AA097' },
  pressed: { opacity: 0.75 },
});
