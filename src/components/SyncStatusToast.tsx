import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

export interface SyncStatusPayload {
  message?: string;
  status?: 'loading' | 'success' | 'error';
  autoHideDuration?: number;
}

export default function SyncStatusToast() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('サーバーに送信中...');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<any>(null);

  useEffect(() => {
    const showSub = DeviceEventEmitter.addListener('SHOW_SYNC_STATUS', (data: SyncStatusPayload) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);

      setMessage(data.message || 'サーバーに送信中...');
      setStatus(data.status || 'loading');
      setVisible(true);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (data.status === 'success' || data.status === 'error') {
        hideTimer.current = setTimeout(() => {
          hideToast();
        }, data.autoHideDuration || 2000);
      }
    });

    const hideSub = DeviceEventEmitter.addListener('HIDE_SYNC_STATUS', (data?: SyncStatusPayload) => {
      if (data?.message) {
        setMessage(data.message);
        setStatus(data.status || 'success');
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
          hideToast();
        }, data.autoHideDuration || 1500);
      } else {
        hideToast();
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          top: Math.max(insets.top + 10, 16),
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.toastContent}>
        {status === 'loading' && (
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
        )}
        {status === 'success' && (
          <Ionicons name="checkmark-circle" size={18} color="#2ECC71" style={styles.icon} />
        )}
        {status === 'error' && (
          <Ionicons name="alert-circle" size={18} color="#E74C3C" style={styles.icon} />
        )}
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 25, 35, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: '90%',
  },
  icon: {
    marginRight: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
