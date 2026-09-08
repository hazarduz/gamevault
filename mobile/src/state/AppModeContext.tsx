import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { DataSource } from "@/data/DataSource";
import { LocalDataSource } from "@/data/LocalDataSource";
import { RemoteDataSource, loginToServer } from "@/data/RemoteDataSource";

type Mode = "unset" | "local" | "remote";

const STORAGE_KEY = "gamevault.mode";
const TOKEN_KEY = "gamevault.token"; // SecureStore only, never AsyncStorage

interface Persisted {
  mode: Mode;
  serverUrl?: string;
  username?: string;
}

interface AppModeState {
  loading: boolean;
  mode: Mode;
  serverUrl: string | null;
  username: string | null;
  dataSource: DataSource | null;
  useLocalMode: () => Promise<void>;
  connectToServer: (serverUrl: string, username: string, password: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

const AppModeContext = createContext<AppModeState | null>(null);

function normalizeUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("unset");
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved: Persisted | null = raw ? JSON.parse(raw) : null;

        if (saved?.mode === "local") {
          setMode("local");
          setDataSource(new LocalDataSource());
        } else if (saved?.mode === "remote" && saved.serverUrl) {
          const token = await SecureStore.getItemAsync(TOKEN_KEY);
          if (token) {
            setMode("remote");
            setServerUrl(saved.serverUrl);
            setUsername(saved.username ?? null);
            setDataSource(new RemoteDataSource(saved.serverUrl, token));
          }
          // No stored token: fall through to "unset" and make the user
          // sign in again rather than guessing.
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const useLocalMode = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "local" } satisfies Persisted));
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setMode("local");
    setServerUrl(null);
    setUsername(null);
    setDataSource(new LocalDataSource());
  };

  const connectToServer = async (rawUrl: string, user: string, password: string) => {
    const url = normalizeUrl(rawUrl);
    const { token, username: confirmedUsername } = await loginToServer(url, user, password);

    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode: "remote", serverUrl: url, username: confirmedUsername } satisfies Persisted)
    );

    setMode("remote");
    setServerUrl(url);
    setUsername(confirmedUsername);
    setDataSource(new RemoteDataSource(url, token));
  };

  const disconnect = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setMode("unset");
    setServerUrl(null);
    setUsername(null);
    setDataSource(null);
  };

  const value = useMemo(
    () => ({ loading, mode, serverUrl, username, dataSource, useLocalMode, connectToServer, disconnect }),
    [loading, mode, serverUrl, username, dataSource]
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeState {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used within AppModeProvider");
  return ctx;
}
