import { SafeAreaView, StyleSheet, Text } from 'react-native';

import { BrandColors } from '@/constants/theme';

export default function MoreScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>더보기</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: BrandColors.text,
    fontSize: 22,
    fontWeight: '800',
  },
});
