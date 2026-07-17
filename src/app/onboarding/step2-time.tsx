import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getSettings, savePeriodTime } from '../../services/dbService';
import { getDefaultPeriodTime, validateTimeFormat } from '../../utils/timeUtils';

export default function OnboardingStep2Time() {
  const router = useRouter();
  const [timetablePeriods, setTimetablePeriods] = useState<number>(5);
  const [periodTimesInput, setPeriodTimesInput] = useState<{ period: number; start_time: string; end_time: string }[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getSettings();
        const periods = settings['timetable_periods'] ? Number(settings['timetable_periods']) : 5;
        setTimetablePeriods(periods);
        
        // 初期データとして既存のデフォルト時間をセットする
        const inputs = [];
        let prevEndTime: string | undefined = undefined;
        for (let p = 1; p <= periods; p++) {
          const defaultTime = getDefaultPeriodTime(p, prevEndTime);
          inputs.push({
            period: p,
            start_time: defaultTime.start,
            end_time: defaultTime.end
          });
          prevEndTime = defaultTime.end;
        }
        setPeriodTimesInput(inputs);
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettings();
  }, []);

  const handleTimeChange = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const updated = [...periodTimesInput];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setPeriodTimesInput(updated);
  };

  const handleNext = async () => {
    // バリデーションと保存
    for (const pt of periodTimesInput) {
      const hasStart = !!pt.start_time.trim();
      const hasEnd = !!pt.end_time.trim();

      if (hasStart !== hasEnd) {
        Alert.alert('入力エラー', `${pt.period}限の開始時刻と終了時刻は両方入力するか、両方空欄にしてください。`);
        return;
      }

      if (hasStart && hasEnd) {
        if (!validateTimeFormat(pt.start_time)) {
          Alert.alert('入力エラー', `${pt.period}限の開始時刻が正しくありません。"09:00" のように入力してください。`);
          return;
        }
        if (!validateTimeFormat(pt.end_time)) {
          Alert.alert('入力エラー', `${pt.period}限の終了時刻が正しくありません。"10:30" のように入力してください。`);
          return;
        }

        const [startH, startM] = pt.start_time.split(':').map(Number);
        const [endH, endM] = pt.end_time.split(':').map(Number);
        const startInMinutes = startH * 60 + startM;
        const endInMinutes = endH * 60 + endM;

        if (startInMinutes >= endInMinutes) {
          Alert.alert('入力エラー', `${pt.period}限の開始時刻は、終了時刻より前の時間に設定してください。`);
          return;
        }
      }
    }

    try {
      for (const pt of periodTimesInput) {
        const hasStart = !!pt.start_time.trim();
        const hasEnd = !!pt.end_time.trim();
        if (hasStart && hasEnd) {
          await savePeriodTime(pt.period, pt.start_time.trim(), pt.end_time.trim());
        }
      }
      router.push('/onboarding/step3');
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '時間の保存に失敗しました');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>授業時間の設定</Text>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>授業時間を設定</Text>
          <Text style={styles.subtitle}>各時限の開始・終了時刻を入力してください。後から設定画面で変更・空欄にすることも可能です。</Text>
          
          <View style={styles.settingCard}>
            {periodTimesInput.map((pt, index) => (
              <View key={pt.period} style={styles.periodTimeRow}>
                <View style={styles.periodBadge}>
                  <Text style={styles.periodBadgeText}>{pt.period}</Text>
                </View>
                <TextInput
                  style={styles.timeInput}
                  value={pt.start_time}
                  onChangeText={(text) => handleTimeChange(index, 'start_time', text)}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                />
                <Text style={styles.timeSeparator}>〜</Text>
                <TextInput
                  style={styles.timeInput}
                  value={pt.end_time}
                  onChangeText={(text) => handleTimeChange(index, 'end_time', text)}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>次へ</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.purple.primary 
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: { 
    flexGrow: 1, 
    padding: 24, 
    paddingTop: 20,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: Colors.text.white, 
    marginBottom: 12,
    textAlign: 'center'
  },
  subtitle: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.8)', 
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  settingCard: {
    backgroundColor: Colors.background.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 32,
  },
  periodTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  periodBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.purple.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  periodBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  timeInput: {
    backgroundColor: Colors.background.light,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'center',
    width: 90,
    color: Colors.text.primary,
  },
  timeSeparator: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginHorizontal: 12,
  },
  button: { 
    backgroundColor: Colors.background.white, 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 40,
  },
  buttonText: { 
    color: Colors.purple.primary, 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
});
