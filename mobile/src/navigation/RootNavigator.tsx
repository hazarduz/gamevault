import React from "react";
import { ActivityIndicator, View } from "react-native";
import { DarkTheme, NavigationContainer, Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAppMode } from "@/state/AppModeContext";
import { AuthStackParamList, MainTabParamList, RootStackParamList } from "@/navigation/types";
import { WelcomeScreen } from "@/screens/WelcomeScreen";
import { ServerConnectScreen } from "@/screens/ServerConnectScreen";
import { CollectionScreen } from "@/screens/CollectionScreen";
import { WishlistScreen } from "@/screens/WishlistScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { GameDetailScreen } from "@/screens/GameDetailScreen";
import { AddEditGameScreen } from "@/screens/AddEditGameScreen";
import { colors } from "@/theme/colors";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.accent,
    text: colors.text,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen
        name="ServerConnect"
        component={ServerConnectScreen}
        options={{ headerShown: true, title: "", ...screenOptions }}
      />
    </AuthStack.Navigator>
  );
}

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Collection: "grid-outline",
  Wishlist: "heart-outline",
  Settings: "settings-outline",
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        ...screenOptions,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="Collection" component={CollectionScreen} />
      <Tabs.Screen name="Wishlist" component={WishlistScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { loading, mode } = useAppMode();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {mode === "unset" ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <RootStack.Group>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen
              name="GameDetail"
              component={GameDetailScreen}
              options={{ headerShown: true, title: "", ...screenOptions }}
            />
            <RootStack.Screen
              name="AddEditGame"
              component={AddEditGameScreen}
              options={{ headerShown: true, presentation: "modal", ...screenOptions }}
            />
          </RootStack.Group>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
