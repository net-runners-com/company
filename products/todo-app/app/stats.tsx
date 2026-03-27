import { StyleSheet, Text, View, SafeAreaView, ScrollView } from "react-native";
import { useTodos } from "../src/store/useTodos";
import { C } from "../src/constants/theme";

export default function StatsScreen() {
  const { stats, todos, todayCompleted } = useTodos();

  const xpToNext = 100 - (stats.xp % 100);
  const xpProgress = (stats.xp % 100) / 100;

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86400000);
    const dateStr = date.toISOString().split("T")[0];
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const count = todos.filter(
      (t) => t.done && t.completedAt && new Date(t.completedAt).toISOString().split("T")[0] === dateStr
    ).length;
    return { day: dayNames[date.getDay()], count, isToday: i === 6 };
  });

  const maxWeek = Math.max(...weekData.map((d) => d.count), 1);

  const achievements = [
    { emoji: "🌱", title: "はじめの一歩", desc: "最初のタスクを完了", unlocked: stats.totalCompleted >= 1 },
    { emoji: "🔥", title: "3日連続", desc: "3日連続でタスク完了", unlocked: stats.streak >= 3 },
    { emoji: "⚡", title: "10タスク", desc: "合計10タスク完了", unlocked: stats.totalCompleted >= 10 },
    { emoji: "💪", title: "7日連続", desc: "1週間連続完了", unlocked: stats.streak >= 7 },
    { emoji: "🏆", title: "50タスク", desc: "合計50タスク完了", unlocked: stats.totalCompleted >= 50 },
    { emoji: "👑", title: "Lv.5", desc: "レベル5に到達", unlocked: stats.level >= 5 },
    { emoji: "🌟", title: "30日連続", desc: "1ヶ月連続完了", unlocked: stats.streak >= 30 },
    { emoji: "💎", title: "100タスク", desc: "合計100タスク完了", unlocked: stats.totalCompleted >= 100 },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView style={st.container}>
        <Text style={st.title}>🏆 記録</Text>

        {/* Level */}
        <View style={st.levelCard}>
          <View style={st.levelRow}>
            <Text style={st.levelNum}>Lv.{stats.level}</Text>
            <Text style={st.xpLabel}>{stats.xp} XP</Text>
          </View>
          <View style={st.xpTrack}>
            <View style={[st.xpFill, { flex: xpProgress }]} />
            <View style={{ flex: Math.max(1 - xpProgress, 0.01) }} />
          </View>
          <Text style={st.xpNext}>次のレベルまであと {xpToNext} XP</Text>
        </View>

        {/* Stats */}
        <View style={st.statsRow}>
          <View style={st.statBox}>
            <Text style={st.statEmoji}>🔥</Text>
            <Text style={st.statNum}>{stats.streak}</Text>
            <Text style={st.statLabel}>連続日数</Text>
          </View>
          <View style={st.statBox}>
            <Text style={st.statEmoji}>✅</Text>
            <Text style={st.statNum}>{stats.totalCompleted}</Text>
            <Text style={st.statLabel}>累計完了</Text>
          </View>
          <View style={st.statBox}>
            <Text style={st.statEmoji}>📅</Text>
            <Text style={st.statNum}>{todayCompleted}</Text>
            <Text style={st.statLabel}>今日</Text>
          </View>
        </View>

        {/* Weekly chart */}
        <View style={st.weekCard}>
          <Text style={st.weekTitle}>今週の活動</Text>
          <View style={st.weekChart}>
            {weekData.map((d, i) => (
              <View key={i} style={st.weekCol}>
                <View style={st.barTrack}>
                  <View style={{ flex: Math.max(1 - d.count / maxWeek, 0.01) }} />
                  <View style={[st.barFill, { flex: Math.max(d.count / maxWeek, 0.02), backgroundColor: d.isToday ? C.amber : C.surfaceLight }]} />
                </View>
                <Text style={st.weekCount}>{d.count}</Text>
                <Text style={[st.weekDay, d.isToday && st.weekDayToday]}>{d.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Achievements */}
        <Text style={st.achieveHeader}>実績 ({unlockedCount}/{achievements.length})</Text>
        <View style={st.achieveGrid}>
          {achievements.map((a, i) => (
            <View key={i} style={[st.achieveItem, !a.unlocked && st.achieveItemLocked]}>
              <Text style={[st.achieveEmoji, !a.unlocked && { opacity: 0.4 }]}>{a.emoji}</Text>
              <Text style={[st.achieveName, !a.unlocked && { color: C.textDim }]}>{a.title}</Text>
              <Text style={st.achieveDesc}>{a.desc}</Text>
            </View>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: C.text, marginBottom: 16 },

  levelCard: { backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  levelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  levelNum: { fontSize: 32, fontWeight: "bold", color: C.amberGlow },
  xpLabel: { fontSize: 14, color: C.textMuted, fontWeight: "bold" },
  xpTrack: { height: 8, backgroundColor: C.surfaceLight, borderRadius: 4, flexDirection: "row", marginBottom: 8 },
  xpFill: { backgroundColor: C.amber, borderRadius: 4 },
  xpNext: { fontSize: 12, color: C.textDim },

  statsRow: { flexDirection: "row", marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 16, alignItems: "center", marginHorizontal: 4 },
  statEmoji: { fontSize: 24, marginBottom: 4 },
  statNum: { fontSize: 28, fontWeight: "bold", color: C.text },
  statLabel: { fontSize: 11, color: C.textDim, marginTop: 2, fontWeight: "bold" },

  weekCard: { backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  weekTitle: { fontSize: 14, fontWeight: "bold", color: C.textMuted, marginBottom: 16 },
  weekChart: { flexDirection: "row", justifyContent: "space-between", height: 120 },
  weekCol: { flex: 1, alignItems: "center" },
  barTrack: { width: 20, flex: 1, borderRadius: 6, justifyContent: "flex-end" },
  barFill: { borderRadius: 6, minHeight: 4 },
  weekCount: { fontSize: 11, color: C.textDim, marginTop: 4, fontWeight: "bold" },
  weekDay: { fontSize: 11, color: C.textDim, marginTop: 2 },
  weekDayToday: { color: C.amber, fontWeight: "bold" },

  achieveHeader: { fontSize: 14, fontWeight: "bold", color: C.textMuted, marginBottom: 12 },
  achieveGrid: { flexDirection: "row", flexWrap: "wrap" },
  achieveItem: { width: "48%", backgroundColor: C.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10, marginRight: "2%" },
  achieveItemLocked: { opacity: 0.35 },
  achieveEmoji: { fontSize: 28, marginBottom: 6 },
  achieveName: { fontSize: 14, fontWeight: "bold", color: C.text, marginBottom: 2 },
  achieveDesc: { fontSize: 11, color: C.textDim },
});
