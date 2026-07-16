import { Stack } from 'expo-router';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

export default function OnboardingLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  return (
    <View style={styles.outerContainer}>
      <View style={isLargeScreen ? styles.webContainer : styles.mobileContainer}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="step2" />
          <Stack.Screen name="step3" />
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#F2F3F5' : '#FFF', // Webの背景をグレーに
  },
  webContainer: {
    flex: 1,
    width: '100%',
    // 時間割登録(step3)があるため、最大横幅は960pxがちょうど良い
    maxWidth: 960, 
    alignSelf: 'center',
    backgroundColor: '#FFF',
    // 影と境界線
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E5E7EB',
  },
  mobileContainer: {
    flex: 1,
  }
});
