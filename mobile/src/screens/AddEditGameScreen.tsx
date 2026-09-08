import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { useAppMode } from "@/state/AppModeContext";
import { Format, GameInput, PlayStatus } from "@/types/game";
import { colors, statusLabels } from "@/theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "AddEditGame">;

const PLAY_STATUSES: PlayStatus[] = ["unplayed", "in_progress", "completed", "platinum"];
const FORMATS: Format[] = ["Physical", "Digital"];

function numOrNull(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() === "" || Number.isNaN(n) ? null : n;
}

export function AddEditGameScreen({ route, navigation }: Props) {
  const { gameId, startAsWishlist } = route.params ?? {};
  const { dataSource } = useAppMode();
  const isEdit = Boolean(gameId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [region, setRegion] = useState("");
  const [condition, setCondition] = useState("");
  const [format, setFormat] = useState<Format>("Physical");
  const [playStatus, setPlayStatus] = useState<PlayStatus>("unplayed");
  const [personalRating, setPersonalRating] = useState("");
  const [notes, setNotes] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [purchasePriceGbp, setPurchasePriceGbp] = useState("");

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? "Edit Game" : "Add Game" });
    if (!gameId) return;
    (async () => {
      try {
        const g = await dataSource!.getGame(gameId);
        setTitle(g.title);
        setPlatform(g.platform);
        setRegion(g.region ?? "");
        setCondition(g.condition ?? "");
        setFormat(g.format);
        setPlayStatus(g.playStatus);
        setPersonalRating(g.personalRating ? String(g.personalRating) : "");
        setNotes(g.notes ?? "");
        setCoverUrl(g.coverUrl ?? "");
        setPurchasePriceGbp(g.purchasePriceGbp ? String(g.purchasePriceGbp) : "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load this game.");
      } finally {
        setLoading(false);
      }
    })();
  }, [dataSource, gameId, isEdit, navigation]);

  const save = async () => {
    if (!title.trim() || !platform.trim()) {
      Alert.alert("Missing info", "Title and platform are both required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: GameInput = {
        title: title.trim(),
        platform: platform.trim(),
        region: region.trim() || null,
        condition: format === "Digital" ? null : condition.trim() || null,
        format,
        playStatus,
        personalRating: numOrNull(personalRating),
        notes: notes.trim() || null,
        coverUrl: coverUrl.trim() || null,
        purchasePriceGbp: numOrNull(purchasePriceGbp),
        ...(startAsWishlist ? { wishlist: true } : {}),
      };

      if (isEdit && gameId) {
        await dataSource!.updateGame(gameId, input);
      } else {
        await dataSource!.createGame(input);
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this game.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Title *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Platform *</Text>
      <TextInput
        style={styles.input}
        value={platform}
        onChangeText={setPlatform}
        placeholder="e.g. PS5, Switch, PC"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Format</Text>
      <View style={styles.segmented}>
        {FORMATS.map((f) => (
          <Pressable
            key={f}
            style={[styles.segment, format === f && styles.segmentActive]}
            onPress={() => setFormat(f)}
          >
            <Text style={[styles.segmentText, format === f && styles.segmentTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {format === "Physical" ? (
        <>
          <Text style={styles.label}>Region</Text>
          <TextInput
            style={styles.input}
            value={region}
            onChangeText={setRegion}
            placeholder="e.g. PAL, NTSC-U"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Condition</Text>
          <TextInput
            style={styles.input}
            value={condition}
            onChangeText={setCondition}
            placeholder="e.g. Complete in box"
            placeholderTextColor={colors.textMuted}
          />
        </>
      ) : null}

      <Text style={styles.label}>Play status</Text>
      <View style={styles.segmented}>
        {PLAY_STATUSES.map((s) => (
          <Pressable
            key={s}
            style={[styles.segment, playStatus === s && styles.segmentActive]}
            onPress={() => setPlayStatus(s)}
          >
            <Text style={[styles.segmentText, playStatus === s && styles.segmentTextActive]}>
              {statusLabels[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Your rating (1-10)</Text>
      <TextInput
        style={styles.input}
        value={personalRating}
        onChangeText={setPersonalRating}
        keyboardType="number-pad"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Cover image URL</Text>
      <TextInput
        style={styles.input}
        value={coverUrl}
        onChangeText={setCoverUrl}
        autoCapitalize="none"
        placeholder="https://…"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Purchase price (£)</Text>
      <TextInput
        style={styles.input}
        value={purchasePriceGbp}
        onChangeText={setPurchasePriceGbp}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholderTextColor={colors.textMuted}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.saveButtonText}>Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  label: { color: colors.textMuted, fontSize: 12, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segmentText: { color: colors.textMuted, fontSize: 13 },
  segmentTextActive: { color: colors.accentText, fontWeight: "700" },
  error: { color: colors.danger, fontSize: 13, marginTop: 16 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 28,
  },
  saveButtonText: { color: colors.accentText, fontWeight: "700", fontSize: 15 },
});
