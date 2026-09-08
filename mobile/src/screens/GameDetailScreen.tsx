import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { useAppMode } from "@/state/AppModeContext";
import { Game, Trophy } from "@/types/game";
import { colors, statusColors, statusLabels } from "@/theme/colors";
import { TROPHY_TIER_COLORS } from "@/theme/trophyColors";

type Props = NativeStackScreenProps<RootStackParamList, "GameDetail">;

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

// The icon frame borders in PSN's own per-tier color once earned, the
// same treatment as the web app's game detail page — locked trophies
// keep a neutral frame, matching how PSN only reveals the tier's color
// on unlock.
function TrophyRow({ trophy }: { trophy: Trophy }) {
  return (
    <View style={styles.trophyRow}>
      <View
        style={[
          styles.trophyIconFrame,
          { borderColor: trophy.earned ? TROPHY_TIER_COLORS[trophy.type] : colors.border },
        ]}
      >
        {trophy.iconUrl ? (
          <Image source={{ uri: trophy.iconUrl }} style={styles.trophyIcon} resizeMode="cover" />
        ) : null}
      </View>
      <Text style={[styles.trophyName, !trophy.earned && styles.listItemDim]} numberOfLines={2}>
        {trophy.name}
      </Text>
    </View>
  );
}

export function GameDetailScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const { dataSource } = useAppMode();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const g = await dataSource!.getGame(gameId);
      setGame(g);
      navigation.setOptions({ title: g.title });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this game.");
    } finally {
      setLoading(false);
    }
  }, [dataSource, gameId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remove = () => {
    Alert.alert("Delete this game?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await dataSource!.deleteGame(gameId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !game) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Not found."}</Text>
      </View>
    );
  }

  const trophies = game.trophies ?? [];
  const achievements = game.achievements ?? [];

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {game.coverUrl ? (
          <Image source={{ uri: game.coverUrl }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.title}>{game.title}</Text>
          <Text style={styles.platform}>{game.platform}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[game.playStatus] }]}>
            <Text style={styles.statusBadgeText}>{statusLabels[game.playStatus] ?? game.playStatus}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.actionButton}
          onPress={() => navigation.navigate("AddEditGame", { gameId: game.id })}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={remove}>
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Field label="Region" value={game.region} />
        <Field label="Condition" value={game.condition} />
        <Field label="Format" value={game.format} />
        <Field label="Your rating" value={game.personalRating ? `${game.personalRating}/10` : null} />
        <Field label="Genres" value={game.genres?.length ? game.genres.join(", ") : null} />
        <Field label="Developer" value={game.developer} />
        <Field label="Publisher" value={game.publisher} />
        <Field label="Purchase price" value={game.purchasePriceGbp ? `£${game.purchasePriceGbp}` : null} />
        <Field
          label="Value (loose / CIB / new)"
          value={
            game.valueLooseGbp || game.valueCibGbp || game.valueNewGbp
              ? `£${game.valueLooseGbp ?? "–"} / £${game.valueCibGbp ?? "–"} / £${game.valueNewGbp ?? "–"}`
              : null
          }
        />
      </View>

      {game.summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summary}>{game.summary}</Text>
        </View>
      ) : null}

      {game.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.summary}>{game.notes}</Text>
        </View>
      ) : null}

      {trophies.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Trophies · {trophies.filter((t) => t.earned).length}/{trophies.length}
          </Text>
          {trophies.map((t) => (
            <TrophyRow key={t.id} trophy={t} />
          ))}
        </View>
      ) : null}

      {achievements.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Achievements · {achievements.filter((a) => a.earned).length}/{achievements.length}
          </Text>
          {achievements.map((a) => (
            <Text key={a.id} style={[styles.listItem, !a.earned && styles.listItemDim]}>
              {a.earned ? "★" : "•"} {a.name}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  error: { color: colors.danger },
  header: { flexDirection: "row", gap: 14 },
  cover: { width: 110, height: 146, borderRadius: 10, backgroundColor: colors.surface },
  coverPlaceholder: {},
  headerText: { flex: 1, justifyContent: "center" },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  platform: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 10,
  },
  statusBadgeText: { color: colors.background, fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 20 },
  actionButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionButtonText: { color: colors.text, fontWeight: "600" },
  deleteButton: { borderColor: colors.danger },
  deleteButtonText: { color: colors.danger },
  section: { marginTop: 24 },
  sectionTitle: { color: colors.text, fontWeight: "700", fontSize: 14, marginBottom: 8 },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  fieldLabel: { color: colors.textMuted, fontSize: 13 },
  fieldValue: { color: colors.text, fontSize: 13, flexShrink: 1, textAlign: "right" },
  summary: { color: colors.text, fontSize: 13, lineHeight: 19 },
  listItem: { color: colors.text, fontSize: 13, paddingVertical: 3 },
  listItemDim: { color: colors.textMuted },
  trophyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  trophyIconFrame: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
  },
  trophyIcon: { width: "100%", height: "100%" },
  trophyName: { flex: 1, color: colors.text, fontSize: 13 },
});
