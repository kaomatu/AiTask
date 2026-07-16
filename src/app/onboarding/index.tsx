import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useSQLiteContext } from 'expo-sqlite';

export default function OnboardingStep1() {
  const [name, setName] = useState('');
  const router = useRouter();
  const db = useSQLiteContext();

  const handleNext = async () => {
    if (!name.trim()) {
      Alert.alert('エラー', '名前を入力してください');
      return;
    }
    try {
      await db.runAsync(
        "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
        ['user_name', name.trim(), name.trim()]
      );
      router.push('/onboarding/step2');
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <Text style={styles.title}>ようこそ！</Text>
          <Text style={styles.subtitle}>まずはあなたの名前を教えてください。</Text>
          <TextInput
            style={styles.input}
            placeholder="お名前 (ニックネーム可)"
            placeholderTextColor={Colors.text.secondary}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>次へ</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.white },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.purple.primary, marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: Colors.text.secondary, marginBottom: 32, textAlign: 'center' },
  input: { backgroundColor: Colors.background.light, color: Colors.text.primary, padding: 16, borderRadius: 12, fontSize: 18, marginBottom: 24 },
  button: { backgroundColor: Colors.purple.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
