import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useSQLiteContext } from 'expo-sqlite';

export default function OnboardingStep1() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const db = useSQLiteContext();

  const handleNext = async () => {
    if (!username.trim()) {
      Alert.alert('エラー', 'ユーザー名を入力してください');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('エラー', '有効なメールアドレスを入力してください');
      return;
    }
    if (password.length < 6) {
      Alert.alert('エラー', 'パスワードは6文字以上で入力してください');
      return;
    }

    try {
      // ユーザー名をローカルDBに保存（ダッシュボード等での表示用）
      await db.runAsync(
        "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
        ['user_name', username.trim(), username.trim()]
      );
      
      // メールアドレスもローカルに一時保存（Firebase連携用）
      await db.runAsync(
        "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
        ['user_email', email.trim(), email.trim()]
      );

      // 注: Firebase Authenticationとの実際の接続は、この後のFirebase移行ステップで実装します。
      router.push('/onboarding/step2');
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.title}>アカウント作成</Text>
            <Text style={styles.subtitle}>アプリを利用するためのアカウント情報を入力してください。</Text>
            
            <View style={styles.formCard}>
              <Text style={styles.label}>ユーザー名</Text>
              <TextInput
                style={styles.input}
                placeholder="お名前 (ニックネーム可)"
                placeholderTextColor={Colors.text.secondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              <Text style={styles.label}>メールアドレス</Text>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor={Colors.text.secondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>パスワード</Text>
              <TextInput
                style={styles.input}
                placeholder="6文字以上"
                placeholderTextColor={Colors.text.secondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>次へ</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.white },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.purple.primary, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.text.secondary, marginBottom: 24, textAlign: 'center', lineHeight: 20 },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#F0F0F0',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  input: { 
    backgroundColor: Colors.background.light, 
    color: Colors.text.primary, 
    padding: 14, 
    borderRadius: 10, 
    fontSize: 16, 
    marginBottom: 16 
  },
  button: { backgroundColor: Colors.purple.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
