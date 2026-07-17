import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomDrawerContent(props: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>メニュー</Text>
        </View>

        <View style={styles.menuSection}>
          <DrawerItem
            label="ホーム"
            labelStyle={styles.label}
            icon={({ color, size }) => <Ionicons name="home-outline" size={24} color={Colors.purple.primary} />}
            onPress={() => router.push('/')}
          />
          <DrawerItem
            label="タスク一覧"
            labelStyle={styles.label}
            icon={({ color, size }) => <Ionicons name="list-outline" size={24} color={Colors.purple.primary} />}
            onPress={() => router.push('/tasks-overview')}
          />
          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>カレンダー</Text>
          <DrawerItem
            label="週表示"
            labelStyle={styles.label}
            icon={({ color, size }) => <Ionicons name="calendar-outline" size={24} color={Colors.purple.primary} />}
            onPress={() => router.push('/calendar-week')}
          />
          <DrawerItem
            label="月表示"
            labelStyle={styles.label}
            icon={({ color, size }) => <Ionicons name="calendar-clear-outline" size={24} color={Colors.purple.primary} />}
            onPress={() => router.push('/calendar-month')}
          />
          <DrawerItem
            label="時間割"
            labelStyle={styles.label}
            icon={({ color, size }) => <Ionicons name="grid-outline" size={24} color={Colors.purple.primary} />}
            onPress={() => router.push('/timetable')}
          />

          <View style={styles.divider} />
          
          <DrawerItem
            label="設定"
            labelStyle={styles.label}
            icon={({ color, size }) => <Ionicons name="settings-outline" size={24} color={Colors.purple.primary} />}
            onPress={() => router.push('/settings')}
          />
        </View>
      </DrawerContentScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.white,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.purple.primary,
  },
  menuSection: {
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.secondary,
    marginLeft: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.background.light,
    marginVertical: 10,
    marginHorizontal: 16,
  },
});
