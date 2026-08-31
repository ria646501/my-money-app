import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandColors } from '@/constants/theme';

const CATEGORIES = ['식사', '카페', '쇼핑', '교통', '취미', '생활', '기타'] as const;
const SATISFACTIONS = ['😫', '😕', '😐', '🙂', '😍'] as const;

type Category = (typeof CATEGORIES)[number];
type Satisfaction = (typeof SATISFACTIONS)[number];

export default function HomeScreen() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [memo, setMemo] = useState('');

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }).format(new Date()),
    []
  );

  const canSubmit = Number(amount) > 0 && category !== null && satisfaction !== null;

  const handleAmountChange = (value: string) => {
    setAmount(value.replace(/[^0-9]/g, ''));
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      Alert.alert('조금만 더 알려주세요', '금액, 카테고리, 만족도를 모두 선택해 주세요.');
      return;
    }

    Alert.alert(
      '입력 내용이 준비됐어요',
      '이번 단계에서는 화면 동작만 확인합니다. 실제 저장은 다음 단계에서 연결할게요.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.date}>{today}</Text>
            <Text style={styles.title}>오늘의 소비</Text>
          </View>

          <View style={styles.entryArea}>
            <View style={styles.form}>
              <View style={styles.section}>
                <Text style={styles.label}>금액</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    accessibilityLabel="소비 금액"
                    keyboardType="number-pad"
                    maxLength={10}
                    onChangeText={handleAmountChange}
                    placeholder="0"
                    placeholderTextColor="#B2AAA0"
                    style={styles.amountInput}
                    value={amount ? Number(amount).toLocaleString('ko-KR') : ''}
                  />
                  <Text style={styles.currency}>원</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>어디에 썼어?</Text>
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
                          pressed && styles.buttonPressed,
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
                <Text style={styles.label}>만족도</Text>
                <View style={styles.satisfactionRow}>
                  {SATISFACTIONS.map((item) => {
                    const isSelected = satisfaction === item;

                    return (
                      <Pressable
                        accessibilityLabel={`만족도 ${item}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={item}
                        onPress={() => setSatisfaction(item)}
                        style={({ pressed }) => [
                          styles.satisfactionButton,
                          isSelected && styles.satisfactionButtonSelected,
                          pressed && styles.buttonPressed,
                        ]}>
                        <Text style={styles.emoji}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>메모 (선택)</Text>
                <TextInput
                  accessibilityLabel="소비 메모"
                  maxLength={100}
                  onChangeText={setMemo}
                  placeholder="간단한 메모"
                  placeholderTextColor="#9CA3AF"
                  style={styles.memoInput}
                  value={memo}
                />
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
                pressed && canSubmit && styles.submitButtonPressed,
              ]}>
              <Text
                style={[styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}>
                기록하기
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFBF8',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 42,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 22,
  },
  date: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  title: {
    color: '#20231D',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  entryArea: {
    flexShrink: 0,
  },
  form: {
    gap: 18,
  },
  section: {
    gap: 8,
  },
  label: {
    color: '#343832',
    fontSize: 15,
    fontWeight: '700',
  },
  amountInputContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  amountInput: {
    color: '#20231D',
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    paddingVertical: 8,
  },
  currency: {
    color: '#555B52',
    fontSize: 16,
    fontWeight: '600',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: '22%',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  categoryButtonSelected: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  categoryText: {
    color: '#555B52',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextSelected: {
    color: BrandColors.onPrimary,
  },
  satisfactionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  satisfactionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  satisfactionButtonSelected: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
    borderWidth: 2,
  },
  emoji: {
    fontSize: 26,
  },
  memoInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    color: '#343832',
    fontSize: 15,
    height: 44,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E8E2',
  },
  submitButtonPressed: {
    backgroundColor: BrandColors.primaryPressed,
    transform: [{ scale: 0.99 }],
  },
  submitButtonText: {
    color: BrandColors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  submitButtonTextDisabled: {
    color: '#9AA097',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
