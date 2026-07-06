import AsyncStorage from '@react-native-async-storage/async-storage';

// 保存する設定のキー名
const SETTINGS_KEY = '@app_settings';

// 設定の型定義
export interface AppSettings {
  maxDays: number;    // 時間割の最大曜日（例: 5 = 土曜まで）
  maxPeriods: number; // 時間割の最大時限（例: 6 = 6限まで）
}

// デフォルトの設定値
const DEFAULT_SETTINGS: AppSettings = {
  maxDays: 5,
  maxPeriods: 6,
};

/**
 * アプリの設定を取得する
 * 保存されていない場合はデフォルト値を返す
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
    if (jsonValue != null) {
      return JSON.parse(jsonValue) as AppSettings;
    }
    return DEFAULT_SETTINGS;
  } catch (e) {
    console.error('Failed to load settings:', e);
    return DEFAULT_SETTINGS;
  }
}

/**
 * アプリの設定を保存する
 * @param settings 保存する設定オブジェクト
 */
export async function saveAppSettings(settings: AppSettings): Promise<void> {
  try {
    const jsonValue = JSON.stringify(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save settings:', e);
    throw e;
  }
}
