import { Tabs } from "expo-router";
import { C } from "../src/constants/theme";

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: C.amberGlow,
        tabBarInactiveTintColor: C.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "フォーカス", tabBarIcon: ({ color }) => tabIcon("🎯", color) }}
      />
      <Tabs.Screen
        name="dump"
        options={{ title: "ダンプ", tabBarIcon: ({ color }) => tabIcon("📥", color) }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: "タスク", tabBarIcon: ({ color }) => tabIcon("📋", color) }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: "記録", tabBarIcon: ({ color }) => tabIcon("🏆", color) }}
      />
    </Tabs>
  );
}

import { Text } from "react-native";
const tabIcon = (emoji: string, _color: string) => (
  <Text style={{ fontSize: 20 }}>{emoji}</Text>
);
