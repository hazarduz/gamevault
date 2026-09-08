import React, { useCallback } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { GameGrid } from "@/components/GameGrid";
import { useAppMode } from "@/state/AppModeContext";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Wishlist">,
  NativeStackScreenProps<RootStackParamList>
>;

export function WishlistScreen({ navigation }: Props) {
  const { dataSource } = useAppMode();

  const fetcher = useCallback(() => dataSource!.listWishlist(), [dataSource]);

  return (
    <GameGrid
      fetcher={fetcher}
      emptyTitle="Nothing on your wishlist"
      emptySubtitle="Tap + to add a game you want."
      onSelect={(g) => navigation.navigate("GameDetail", { gameId: g.id })}
      onAdd={() => navigation.navigate("AddEditGame", { startAsWishlist: true })}
    />
  );
}
