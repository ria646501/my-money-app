import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { TimeWheelPicker } from '@/components/time-wheel-picker';
import { BrandColors } from '@/constants/theme';
import { TimeSelection } from '@/lib/expense-record';

type TimePickerModalProps = {
  value: TimeSelection;
  visible: boolean;
  onChange: (value: TimeSelection) => void;
  onClose: () => void;
};

export function TimePickerModal({ value, visible, onChange, onClose }: TimePickerModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>소비 시간</Text>
          <TimeWheelPicker onChange={onChange} value={value} />
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}>
            <Text style={styles.doneButtonText}>완료</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(25, 29, 23, 0.35)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FAFBF8',
    borderRadius: 20,
    maxWidth: 360,
    padding: 20,
    width: '100%',
  },
  title: {
    color: '#20231D',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  doneButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
  },
  doneButtonPressed: { backgroundColor: BrandColors.primaryPressed },
  doneButtonText: { color: BrandColors.onPrimary, fontSize: 15, fontWeight: '800' },
});
