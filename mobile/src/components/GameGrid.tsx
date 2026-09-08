import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Game } from "@/types/game";
import { GameCard } from "@/components/GameCard";
import { EmptyState } from "@/components/EmptyState";
import { colors } from "@/theme/colors";

interface Props {
  fetcher: (q: string) => Promise<Game[]>;
  emptyTitle: string;
  emptySubtitle: string;
  onSelect: (game: Game) => void;
  onAdd: () => void;
}

export function GameGrid({ fetcher, emptyTitle, emptySubtitle, onSelect, onAdd }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (q: string) => {
      try {
        setError(null);
        const result = await fetcher(q);
        setGames(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load your collection.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetcher]
  );

  // Reload every time the tab regains focus (e.g. after adding/editing a
  // game and navigating back) rather than only on mount.
  useFocusEffect(
    useCallback(() => {
      load(query);
    }, [load, query])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(query);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => load(query)}
          returnKeyType="search"
        />
        <Pressable style={styles.addButton} onPress={onAdd}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && games.length === 0 ? (
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
      ) : (
        <FlatList
          data={games}
          key="grid-2"
          numColumns={2}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          renderItem={({ item }) => <GameCard game={item} onPress={() => onSelect(item)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  searchRow: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
  },
  search: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: colors.accentText,
    fontSize: 22,
    fontWeight: "700",
    marginTop: -2,
  },
  list: {
    paddingHorizontal: 6,
    paddingBottom: 24,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  hint: {
    display: "none",
  },
});
