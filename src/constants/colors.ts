/**
 * ===================================
 * アプリ全体のカラーパレット定義
 * 使い方: import { Colors } from "@/constants/colors";
 * ===================================
 */

export const Colors = {
  // --- メインカラー（紫系） ---
  purple: {
    primary: "#4C4DDC", // メインの紫
    light: "#6A6BE0",   // 薄めの紫
    dark: "#2F31A8",    // 濃い紫
  },

  // --- アクセントカラー（黄色系：濃い → 薄い） ---
  yellow: {
    superdark: "#FF8D28",
    dark: "#FACC14",   // 濃い黄色（バッジ・ボタンなど）
    medium: "#FFE57D", // 中間の黄色（タスクカードの左ボーダーなど）
    light: "#FFFFC8",  // 薄い黄色（タスクカードの背景など）
  },

  // --- テキストカラー ---
  text: {
    primary: "#333333",   // メインのテキスト
    secondary: "#888888", // 補助的なテキスト
    white: "#FFFFFF",     // 白テキスト（紫背景上）
  },

  // --- 背景色 ---
  background: {
    white: "#FFFFFF",
    light: "#F5F5F5",
  },

  // --- カレンダー用 ---
  calendar: {
    sunday: "#E74C3C",   // 日曜の色
    saturday: "#3498DB", // 土曜の色
  },
} as const;
