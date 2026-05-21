import { StyleSheet, Text, View } from "react-native";

export default function Page_2() {
    return (
        <View style={styles.container}>
            <Text>まー君、この文章が見れたかな？</Text>
            <Text>見えたら「おめでとう」ってLINEで送ってね❤️</Text>
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
