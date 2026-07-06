import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BottomNavBar() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom, height: 70 + insets.bottom }]}>
      {/* Android用のフェイク上向き影（Androidはelevationが下向きにしか落ちないため） */}
      {Platform.OS === 'android' && (
        <LinearGradient
          colors={['transparent', 'rgba(0, 0, 0, 0.08)']}
          style={styles.androidShadow}
          pointerEvents="none"
        />
      )}

      {/* 左のアイコン */}
      <TouchableOpacity style={styles.iconButton}>
        <Ionicons name="calendar-outline" size={28} color={Colors.purple.primary} />
      </TouchableOpacity>

      {/* 真ん中の大きな＋ボタン */}
      <View style={styles.centerButtonWrapper}>
        <TouchableOpacity style={styles.centerButton}>
          <Ionicons name="add" size={40} color={Colors.text.white} />
        </TouchableOpacity>
      </View>

      {/* 右のアイコン */}
      <TouchableOpacity style={styles.iconButton}>
        <Ionicons name="settings-outline" size={28} color={Colors.purple.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: Colors.background.white,
    height: 70, // バーの高さ
    // 上部の影を設定
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
    
    // 画面下部に固定
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  androidShadow: {
    position: 'absolute',
    top: -16, // 影の高さ分上にずらす
    left: 0,
    right: 0,
    height: 16,
  },
  iconButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    top: -20, // バーの上に少しはみ出させる
  },
  centerButton: {
    backgroundColor: Colors.purple.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    // ボタン自体の影
    shadowColor: Colors.purple.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
