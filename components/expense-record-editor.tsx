import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TimeWheelPicker } from '@/components/time-wheel-picker';
import { BrandColors } from '@/constants/theme';
import {
  CATEGORIES,
  Category,
  ExpenseRecord,
  getRecordTimeSelection,
  SATISFACTIONS,
  Satisfaction,
  TimeSelection,
} from '@/lib/expense-record';

export type ExpenseEditValues = {
  amount: number;
  category: Category;
  satisfaction: Satisfaction;
  memo: string;
  time: TimeSelection;
};

type ExpenseRecordEditorProps = {
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
  record,
  onClose,
  onDelete,
  onSave,
}: ExpenseRecordEditorProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
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
    setCategory(record.category);
    setSatisfaction(record.satisfaction);
    setMemo(record.memo);
    setTime(getRecordTimeSelection(record));
  }, [record]);

  const canSave = Number(amount) > 0 && category !== null && satisfaction !== null;

  const handleSave = () => {
    if (record === null || !canSave || category === null || satisfaction === null) {
      return;
    }

    void onSave(record, {
      amount: Number(amount),
      category,
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
          <View style={styles.card}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              ref={scrollRef}
              showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>소비 기록 수정</Text>
                  {record ? (
                    <Text style={styles.date}>
                      {formatDate(record.localDate)} · {record.timeZone}
                    </Text>
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

              <View style={styles.section}>
                <Text style={styles.label}>금액</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    accessibilityLabel="수정할 소비 금액"
                    keyboardType="number-pad"
                    maxLength={10}
                    onChangeText={(value) => setAmount(value.replace(/[^0-9]/g, ''))}
                    style={styles.amountInput}
                    value={amount}
                  />
                  <Text style={styles.currency}>원</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>카테고리</Text>
                <View style={styles.optionGrid}>
                  {CATEGORIES.map((item) => {
                    const isSelected = category === item;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={item}
                        onPress={() => setCategory(item)}
                        style={({ pressed }) => [
                          styles.categoryButton,
                          isSelected && styles.categoryButtonSelected,
                          pressed && styles.pressed,
                        ]}>
                        <Text
                          style={[
                            styles.categoryText,
                            isSelected && styles.categoryTextSelected,
                          ]}>
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>개별 소비 만족도</Text>
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
                          isSelected && styles.satisfactionButtonSelected,
                          pressed && styles.pressed,
                        ]}>
                        <Text style={styles.satisfactionEmoji}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>메모 (선택)</Text>
                <TextInput
                  accessibilityLabel="수정할 소비 메모"
                  maxLength={100}
                  onChangeText={setMemo}
                  placeholder="간단한 메모"
                  placeholderTextColor="#9CA3AF"
                  style={styles.memoInput}
                  value={memo}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>소비 시간</Text>
                <TimeWheelPicker
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
                    저장
                  </Text>
                </Pressable>
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
  overlay: {
    backgroundColor: 'rgba(25, 29, 23, 0.35)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FAFBF8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  content: { paddingBottom: 34, paddingHorizontal: 20, paddingTop: 18 },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  title: { color: '#20231D', fontSize: 22, fontWeight: '800' },
  date: { color: '#7A8177', fontSize: 12, marginTop: 5 },
  closeButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  closeText: { color: '#596057', fontSize: 30, fontWeight: '300', lineHeight: 32 },
  section: { gap: 8, marginBottom: 18 },
  label: { color: '#343832', fontSize: 14, fontWeight: '700' },
  amountInputContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 13,
  },
  amountInput: { color: '#20231D', flex: 1, fontSize: 20, fontWeight: '700' },
  currency: { color: '#555B52', fontSize: 15, fontWeight: '600' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  categoryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: '22%',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 8,
  },
  categoryButtonSelected: { backgroundColor: BrandColors.primary, borderColor: BrandColors.primary },
  categoryText: { color: '#555B52', fontSize: 13, fontWeight: '600' },
  categoryTextSelected: { color: BrandColors.onPrimary },
  satisfactionRow: { flexDirection: 'row', gap: 7 },
  satisfactionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  satisfactionButtonSelected: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
    borderWidth: 2,
  },
  satisfactionEmoji: { fontSize: 24 },
  memoInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 11,
    borderWidth: 1,
    color: '#343832',
    fontSize: 14,
    height: 44,
    paddingHorizontal: 12,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5B9B3',
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    width: 88,
  },
  deleteButtonText: { color: '#B65045', fontSize: 15, fontWeight: '700' },
  saveButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 13,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  saveButtonDisabled: { backgroundColor: '#E5E8E2' },
  saveButtonPressed: { backgroundColor: BrandColors.primaryPressed },
  saveButtonText: { color: BrandColors.onPrimary, fontSize: 15, fontWeight: '800' },
  saveButtonTextDisabled: { color: '#9AA097' },
  pressed: { opacity: 0.75 },
});
