import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Text, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import Timetable from "@/components/Timetable";
import BottomNavBar from "@/components/BottomNavBar";

export default function TimetableScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshKey, setRefreshKey] = useState(0);

  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* ヘッダー行 */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
          <Ionicons name="home-outline" size={28} color={Colors.text.white} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>時間割</Text>
        
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => router.push("/timetable-edit")}
        >
          <Ionicons name="create-outline" size={28} color={Colors.text.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.frame}>
        <View style={[
          styles.contentWrapper, 
          isLargeScreen ? styles.webLayout : styles.mobileLayout
        ]}>
          <Timetable isEditMode={false} refreshKey={refreshKey} />
        </View>

        <BottomNavBar onTaskCreated={() => setRefreshKey(prev => prev + 1)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.purple.primary,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 4,
  },
  editButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.text.white,
  },
  frame: {
    flex: 1,
    backgroundColor: "transparent",
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90, // BottomNavBarの分のマージン
  },
  mobileLayout: {
    width: "100%",
  },
  webLayout: {
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  }
});
