export type AuthStackParamList = {
  Welcome: undefined;
  ServerConnect: undefined;
};

export type MainTabParamList = {
  Collection: undefined;
  Wishlist: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  GameDetail: { gameId: string };
  AddEditGame: { gameId?: string; startAsWishlist?: boolean };
};
