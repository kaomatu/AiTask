import Button from '@/components/Button';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from "react-native";

export default function Index() {

  const router = useRouter(); // ルーターを初期化

  const handlePress = () => {
    // "/page_2"に遷移
    router.push('/page_2');
  };

  return (
    <View style={styles.container}>
      <Text>Hello World</Text>
      <Button
        title="ページ遷移"
        iconName="arrow-right"
        onPress={handlePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
