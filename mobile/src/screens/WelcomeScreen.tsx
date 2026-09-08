import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "@/navigation/types";
import { useAppMode } from "@/state/AppModeContext";
import { colors } from "@/theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  const { useLocalMode } = useAppMode();

  const chooseOffline = () => {
    Alert.alert(
      "Use this device only?",
      "Your collection will be stored locally on this device only. It won't sync anywhere — switching to a server later starts a separate collection.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => useLocalMode() },
      ]
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.logo}>GameVault</Text>
      <Text style={styles.tagline}>Your collection, wherever you keep it.</Text>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("ServerConnect")}>
          <Text style={styles.primaryButtonText}>Connect to a GameVault server</Text>
        </Pressable>
        <Text style={styles.helpText}>Sign in to a GameVault instance you already host.</Text>

        <Pressable style={styles.secondaryButton} onPress={chooseOffline}>
          <Text style={styles.secondaryButtonText}>Use this device only</Text>
        </Pressable>
        <Text style={styles.helpText}>Keep your collection fully offline, stored on this phone.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 8,
    marginBottom: 48,
  },
  actions: {
    width: "100%",
    maxWidth: 360,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.accentText,
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  helpText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
