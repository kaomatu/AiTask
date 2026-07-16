import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useSQLiteContext } from 'expo-sqlite';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { initializeUserData, getSettings } from '../../services/dbService';
import { useAuth } from '../../context/AuthContext';

export default function OnboardingStep1() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const db = useSQLiteContext();
  const { setOnboardingCompleted } = useAuth();

  const handleNext = async () => {
    if (mode === 'signup') {
      if (!username.trim()) {
        Alert.alert('エラー', 'ユーザー名を入力してください');
        return;
      }
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
      if (mode === 'signup') {
        // 1. Firebase Authでアカウント作成
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // 2. Firebase プロフィールの表示名を更新
        await updateProfile(user, { displayName: username.trim() });

        // 3. Firestore に初期デフォルト設定データを投入
        await initializeUserData(user.uid, username.trim());

        // 4. SQLite にもローカル保存 (下位互換性のため)
        await db.runAsync(
          "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
          ['user_name', username.trim(), username.trim()]
        );
        
        await db.runAsync(
          "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
          ['user_email', email.trim(), email.trim()]
        );

        // step2 へ進む
        console.log('✅ アカウント作成完了 → step2 へ遷移開始');
        router.push('/onboarding/step2');
        console.log('✅ router.push 呼び出し完了');
      } else {
        // 1. Firebase Authでログイン
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // 2. Firestoreから設定を取得してSQLiteへ同期
        const settings = await getSettings();
        const fetchedUsername = settings['user_name'] || user.displayName || 'ユーザー';

        await db.runAsync(
          "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
          ['user_name', fetchedUsername, fetchedUsername]
        );
        
        await db.runAsync(
          "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
          ['user_email', email.trim(), email.trim()]
        );

        if (settings['onboarding_completed'] === 'true') {
          await db.runAsync(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
            ['onboarding_completed', 'true', 'true']
          );
          setOnboardingCompleted(true);
          router.replace('/');
        } else {
          router.push('/onboarding/step2');
        }
      }
    } catch (e: any) {
      console.error('❌ handleNext エラー:', e.code, e.message, e);
      let errMsg = mode === 'signup' ? 'アカウントの作成に失敗しました' : 'ログインに失敗しました';
      if (e.code === 'auth/email-already-in-use') {
        errMsg = 'このメールアドレスは既に登録されています。';
      } else if (e.code === 'auth/invalid-email') {
        errMsg = 'メールアドレスの形式が正しくありません。';
      } else if (e.code === 'auth/weak-password') {
        errMsg = 'パスワードが弱すぎます。';
      } else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        errMsg = 'メールアドレスまたはパスワードが正しくありません。';
      } else {
        errMsg += '\n\n詳細: ' + (e.message || JSON.stringify(e));
      }
      Alert.alert('エラー', errMsg);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.title}>
              {mode === 'signup' ? 'アカウント作成' : 'ログイン'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signup' 
                ? 'アプリを利用するためのアカウント情報を入力してください。' 
                : '既存のアカウント情報を入力してログインしてください。'}
            </Text>

            {/* モード切り替えタブ */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tabButton, mode === 'signup' && styles.activeTabButton]}
                onPress={() => setMode('signup')}
              >
                <Text style={[styles.tabText, mode === 'signup' && styles.activeTabText]}>アカウント作成</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabButton, mode === 'login' && styles.activeTabButton]}
                onPress={() => setMode('login')}
              >
                <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>ログイン</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.formCard}>
              {mode === 'signup' && (
                <>
                  <Text style={styles.label}>ユーザー名</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="お名前 (ニックネーム可)"
                    placeholderTextColor={Colors.text.secondary}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    nativeID="username"
                    autoComplete="name"
                  />
                </>
              )}

              <Text style={styles.label}>メールアドレス</Text>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor={Colors.text.secondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                nativeID="email"
                autoComplete="email"
              />

              <Text style={styles.label}>パスワード</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="6文字以上"
                  placeholderTextColor={Colors.text.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  nativeID="password"
                  autoComplete="password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={Colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>
                {mode === 'signup' ? '次へ' : 'ログイン'}
              </Text>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#FFF',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  activeTabText: {
    color: Colors.purple.primary,
  },
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.light,
    borderRadius: 10,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    color: Colors.text.primary,
    padding: 14,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  button: { backgroundColor: Colors.purple.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
