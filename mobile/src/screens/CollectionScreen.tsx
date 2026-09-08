import React, { useCallback } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { GameGrid } from "@/components/GameGrid";
import { useAppMode } from "@/state/AppModeContext";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Collection">,
  NativeStackScreenProps<RootStackParamList>
>;

export function CollectionScreen({ navigation }: Props) {
  const { dataSource } = useAppMode();

  const fetcher = useCallback(
    (q: string) => dataSource!.listCollection(q ? { q } : undefined),
    [dataSource]
  );

  return (
    <GameGrid
      fetcher={fetcher}
      emptyTitle="No games yet"
      emptySubtitle="Tap + to add the first game to your collection."
      onSelect={(g) => navigation.navigate("GameDetail", { gameId: g.id })}
      onAdd={() => navigation.navigate("AddEditGame", {})}
    />
  );
}
