import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Game } from "@/types/game";
import { colors, statusColors, statusLabels } from "@/theme/colors";

export function GameCard({ game, onPress }: { game: Game; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.coverWrap}>
        {game.coverUrl ? (
          <Image source={{ uri: game.coverUrl }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText} numberOfLines={3}>
              {game.title}
            </Text>
          </View>
        )}
        <View style={[styles.statusDot, { backgroundColor: statusColors[game.playStatus] }]} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {game.title}
      </Text>
      <Text style={styles.platform} numberOfLines={1}>
        {game.platform}
        {game.trophies?.length || game.achievements?.length
          ? ` · ${
              (game.trophies?.filter((t) => t.earned).length ?? 0) +
              (game.achievements?.filter((a) => a.earned).length ?? 0)
            } earned`
          : ""}
      </Text>
    </Pressable>
  );
}

export function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    maxWidth: "47%",
  },
  coverWrap: {
    aspectRatio: 3 / 4,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  coverPlaceholderText: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 13,
  },
  statusDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  platform: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
