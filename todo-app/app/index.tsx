import { useState, useEffect, useRef } from "react";
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Animated,
} from "react-native";
import { useTodos } from "../src/store/useTodos";
import { C, CATEGORY_COLORS } from "../src/constants/theme";

export default function FocusScreen() {
  const { todos, stats, getNextTask, toggleDone, todayCompleted, toggleSubtask } = useTodos();
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [showCelebration, setShowCelebration] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const task = getNextTask();
  const pendingCount = todos.filter((t) => !t.done).length;

  useEffect(() => {
    if (!timerRunning || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timeLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleComplete = () => {
    if (!task) return;
    toggleDone(task.id);
    setShowCelebration(true);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setShowCelebration(false));
    setTimerRunning(false);
    setTimeLeft(25 * 60);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>FocusDrop</Text>
          <View style={s.badges}>
            <View style={s.badge}>
              <Text style={s.badgeTextGold}>Lv.{stats.level}</Text>
            </View>
            <View style={s.badge}>
              <Text style={s.badgeText}>🔥 {stats.streak}日</Text>
            </View>
          </View>
        </View>

        {/* Progress */}
        <View style={s.progressWrap}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { flex: Math.min(todayCompleted / 5, 1) }]} />
            <View style={{ flex: Math.max(1 - todayCompleted / 5, 0) }} />
          </View>
          <Text style={s.progressLabel}>今日 {todayCompleted}/5 完了</Text>
        </View>

        {/* Focus Card */}
        {task ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>いま集中するタスク</Text>
            <Text style={s.cardTitle}>{task.text}</Text>
            <View style={[s.catBadge, { backgroundColor: CATEGORY_COLORS[task.category] + "25" }]}>
              <Text style={[s.catText, { color: CATEGORY_COLORS[task.category] }]}>{task.category}</Text>
            </View>

            {/* Subtasks */}
            {task.subtasks.length > 0 && (
              <View style={s.subtasks}>
                {task.subtasks.map((sub) => (
                  <TouchableOpacity key={sub.id} style={s.subRow} onPress={() => toggleSubtask(task.id, sub.id)}>
                    <View style={[s.subCheck, sub.done && s.subCheckDone]}>
                      {sub.done && <Text style={s.subCheckmark}>✓</Text>}
                    </View>
                    <Text style={[s.subText, sub.done && s.subTextDone]}>{sub.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Timer */}
            <View style={s.timerWrap}>
              <View style={s.timerCircle}>
                <Text style={s.timerText}>{formatTime(timeLeft)}</Text>
              </View>
              <View style={s.timerBtns}>
                <TouchableOpacity
                  style={[s.timerBtn, timerRunning && s.timerBtnPause]}
                  onPress={() => setTimerRunning(!timerRunning)}
                >
                  <Text style={s.timerBtnText}>{timerRunning ? "⏸ 一時停止" : "▶ 集中する"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.resetBtn} onPress={() => { setTimeLeft(25 * 60); setTimerRunning(false); }}>
                  <Text style={s.resetBtnText}>↻</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Complete */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity style={s.completeBtn} onPress={handleComplete}>
                <Text style={s.completeBtnText}>✓ 完了！</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🎉</Text>
            <Text style={s.emptyTitle}>全部終わった！</Text>
            <Text style={s.emptyDesc}>「ダンプ」タブで新しいタスクを追加しよう</Text>
          </View>
        )}

        {pendingCount > 1 && task && (
          <Text style={s.queueText}>あと {pendingCount - 1} 件のタスクが待っています</Text>
        )}

        {showCelebration && (
          <Animated.View style={[s.celeb, { opacity: fadeAnim }]}>
            <Text style={s.celebEmoji}>🎉</Text>
            <Text style={s.celebText}>ナイス！+10 XP</Text>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  logo: { fontSize: 24, fontWeight: "bold", color: C.amberGlow, letterSpacing: 1 },
  badges: { flexDirection: "row" },
  badge: { backgroundColor: C.surfaceLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  badgeTextGold: { fontSize: 12, fontWeight: "bold", color: C.amberGlow },
  badgeText: { fontSize: 12, fontWeight: "bold", color: C.text },

  progressWrap: { marginBottom: 20 },
  progressTrack: { height: 6, backgroundColor: C.surface, borderRadius: 3, flexDirection: "row" },
  progressFill: { backgroundColor: C.green, borderRadius: 3 },
  progressLabel: { color: C.textDim, fontSize: 12, marginTop: 6 },

  card: { backgroundColor: C.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.border },
  cardLabel: { color: C.amberGlow, fontSize: 12, fontWeight: "bold", letterSpacing: 1, marginBottom: 8 },
  cardTitle: { color: C.text, fontSize: 22, fontWeight: "bold", lineHeight: 30, marginBottom: 12 },
  catBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 16 },
  catText: { fontSize: 12, fontWeight: "bold" },

  subtasks: { marginBottom: 16 },
  subRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  subCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: 10 },
  subCheckDone: { backgroundColor: C.green, borderColor: C.green },
  subCheckmark: { color: C.white, fontSize: 11, fontWeight: "bold" },
  subText: { color: C.textMuted, fontSize: 14 },
  subTextDone: { textDecorationLine: "line-through", color: C.textDim },

  timerWrap: { alignItems: "center", marginBottom: 20 },
  timerCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.surfaceLight, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  timerText: { fontSize: 28, fontWeight: "bold", color: C.text },
  timerBtns: { flexDirection: "row", alignItems: "center" },
  timerBtn: { backgroundColor: C.amber, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginRight: 10 },
  timerBtnPause: { backgroundColor: C.red },
  timerBtnText: { color: C.white, fontSize: 14, fontWeight: "bold" },
  resetBtn: { backgroundColor: C.surfaceLight, width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  resetBtnText: { color: C.textMuted, fontSize: 18 },

  completeBtn: { backgroundColor: C.green, paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  completeBtnText: { color: C.white, fontSize: 18, fontWeight: "bold" },

  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: C.text, fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  emptyDesc: { color: C.textDim, fontSize: 14 },

  queueText: { color: C.textDim, fontSize: 12, textAlign: "center", marginTop: 16 },

  celeb: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(12,18,34,0.85)" },
  celebEmoji: { fontSize: 80, marginBottom: 16 },
  celebText: { color: C.amberGlow, fontSize: 24, fontWeight: "bold" },
});
