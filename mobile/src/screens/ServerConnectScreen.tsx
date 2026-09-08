import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { useAppMode } from "@/state/AppModeContext";
import { colors } from "@/theme/colors";

export function ServerConnectScreen() {
  const { connectToServer } = useAppMode();
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!serverUrl.trim() || !username.trim() || !password) {
      setError("Server URL, username and password are all required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await connectToServer(serverUrl, username.trim(), password);
      // AppModeProvider flips `mode` to "remote" on success, which swaps
      // the navigator to the main app — nothing else to do here.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Connect to a server</Text>
      <Text style={styles.subtitle}>
        Enter the address of your GameVault instance and sign in with your account.
      </Text>

      <Text style={styles.label}>Server URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://gamevault.example.com"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={serverUrl}
        onChangeText={setServerUrl}
      />

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.buttonText}>Connect</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 24,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: {
    color: colors.accentText,
    fontWeight: "700",
    fontSize: 15,
  },
});
