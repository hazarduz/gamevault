import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { useAppMode } from "@/state/AppModeContext";
import { LocalDataSource } from "@/data/LocalDataSource";
import { colors } from "@/theme/colors";

export function SettingsScreen() {
  const { mode, serverUrl, username, dataSource, disconnect } = useAppMode();
  const [busy, setBusy] = useState(false);

  const confirmDisconnect = () => {
    Alert.alert(
      mode === "local" ? "Stop using this device only?" : "Disconnect from server?",
      "You'll be taken back to the start screen to choose a mode again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", style: "destructive", onPress: () => disconnect() },
      ]
    );
  };

  const exportBackup = async () => {
    if (!(dataSource instanceof LocalDataSource)) return;
    setBusy(true);
    try {
      const games = dataSource.exportAll();
      const path = `${FileSystem.cacheDirectory}gamevault-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify({ games }, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/json" });
      } else {
        Alert.alert("Backup saved", path);
      }
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async () => {
    if (!(dataSource instanceof LocalDataSource)) return;
    const picked = await DocumentPicker.getDocumentAsync({ type: "application/json" });
    if (picked.canceled) return;

    setBusy(true);
    try {
      const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      const parsed = JSON.parse(raw);
      const games = Array.isArray(parsed) ? parsed : parsed.games;
      if (!Array.isArray(games)) throw new Error("That file doesn't look like a GameVault backup.");
      dataSource.importAll(games);
      Alert.alert("Import complete", `Added any games from this backup not already on the device.`);
    } catch (e) {
      Alert.alert("Import failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{mode === "local" ? "This device only" : "Connected"}</Text>
        {mode === "remote" ? (
          <>
            <Text style={styles.cardLine}>{serverUrl}</Text>
            <Text style={styles.cardLine}>Signed in as {username}</Text>
          </>
        ) : (
          <Text style={styles.cardLine}>All data is stored locally on this device only.</Text>
        )}
        <Pressable style={styles.dangerButton} onPress={confirmDisconnect}>
          <Text style={styles.dangerButtonText}>
            {mode === "local" ? "Switch mode" : "Disconnect"}
          </Text>
        </Pressable>
      </View>

      {mode === "local" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backup</Text>
          <Text style={styles.cardLine}>
            This device is the only copy of your data. Export a backup regularly, and keep it
            somewhere safe (cloud drive, email to yourself, etc).
          </Text>
          <Pressable style={styles.button} onPress={exportBackup} disabled={busy}>
            <Text style={styles.buttonText}>Export backup</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={importBackup} disabled={busy}>
            <Text style={styles.buttonText}>Import backup</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.footer}>GameVault Mobile</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: 8 },
  cardLine: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  button: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: colors.text, fontWeight: "600" },
  dangerButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerButtonText: { color: colors.danger, fontWeight: "700" },
  footer: { color: colors.textMuted, textAlign: "center", marginTop: 8, fontSize: 12 },
});
