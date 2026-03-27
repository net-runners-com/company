import { useState } from "react";
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, ScrollView,
} from "react-native";
import { useTodos } from "../src/store/useTodos";
import { C, CATEGORIES, CATEGORY_COLORS, Category } from "../src/constants/theme";

const TIME_OPTIONS = [
  { label: "5分", value: 5 },
  { label: "15分", value: 15 },
  { label: "30分", value: 30 },
  { label: "1時間", value: 60 },
];

export default function DumpScreen() {
  const { addTodo, todos } = useTodos();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("仕事");
  const [estimate, setEstimate] = useState<number | undefined>(undefined);
  const [steps, setSteps] = useState<string[]>([]);
  const [stepText, setStepText] = useState("");
  const [justAdded, setJustAdded] = useState("");

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addTodo(trimmed, category, estimate);
    setJustAdded(trimmed);
    setText("");
    setSteps([]);
    setEstimate(undefined);
    setTimeout(() => setJustAdded(""), 2000);
  };

  const handleAddStep = () => {
    const trimmed = stepText.trim();
    if (!trimmed) return;
    setSteps([...steps, trimmed]);
    setStepText("");
  };

  const recentTodos = todos.slice(0, 5);

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView style={st.container} keyboardShouldPersistTaps="handled">
        <Text style={st.title}>🧠 脳内ダンプ</Text>
        <Text style={st.subtitle}>思いついたことを全部出そう。整理は後でいい。</Text>

        <View style={st.inputCard}>
          <TextInput
            style={st.mainInput}
            placeholder="何をやらなきゃ？"
            placeholderTextColor={C.textDim}
            value={text}
            onChangeText={setText}
            multiline
          />

          <Text style={st.label}>カテゴリ</Text>
          <View style={st.row}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[st.chip, category === c && { backgroundColor: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] }]}
                onPress={() => setCategory(c)}
              >
                <Text style={[st.chipText, category === c && { color: C.white }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.label}>どのくらいかかる？</Text>
          <View style={st.row}>
            {TIME_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[st.chip, estimate === t.value && { backgroundColor: C.amber, borderColor: C.amber }]}
                onPress={() => setEstimate(estimate === t.value ? undefined : t.value)}
              >
                <Text style={[st.chipText, estimate === t.value && { color: C.white }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.label}>小さく分解する（任意）</Text>
          {steps.map((step, i) => (
            <View key={i} style={st.stepItem}>
              <Text style={st.stepNum}>{i + 1}</Text>
              <Text style={st.stepItemText}>{step}</Text>
              <TouchableOpacity onPress={() => setSteps(steps.filter((_, j) => j !== i))}>
                <Text style={st.stepRemove}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={st.stepRow}>
            <TextInput
              style={st.stepInput}
              placeholder="ステップを追加..."
              placeholderTextColor={C.textDim}
              value={stepText}
              onChangeText={setStepText}
              onSubmitEditing={handleAddStep}
              returnKeyType="done"
            />
            <TouchableOpacity style={st.stepAddBtn} onPress={handleAddStep}>
              <Text style={st.stepAddBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[st.addBtn, !text.trim() && st.addBtnDisabled]}
            onPress={handleAdd}
            disabled={!text.trim()}
          >
            <Text style={st.addBtnText}>📥 タスクに追加</Text>
          </TouchableOpacity>
        </View>

        {justAdded !== "" && (
          <View style={st.feedback}>
            <Text style={st.feedbackText}>✓ 「{justAdded}」を追加しました</Text>
          </View>
        )}

        {recentTodos.length > 0 && (
          <View style={st.recent}>
            <Text style={st.recentTitle}>最近追加したタスク</Text>
            {recentTodos.map((t) => (
              <View key={t.id} style={st.recentItem}>
                <View style={[st.recentDot, { backgroundColor: CATEGORY_COLORS[t.category] }]} />
                <Text style={[st.recentText, t.done && st.recentTextDone]} numberOfLines={1}>{t.text}</Text>
                {t.done && <Text style={st.recentDone}>✓</Text>}
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: C.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.textDim, marginBottom: 20 },
  inputCard: { backgroundColor: C.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
  mainInput: { backgroundColor: C.surfaceLight, borderRadius: 12, padding: 16, fontSize: 18, color: C.text, minHeight: 80, textAlignVertical: "top", marginBottom: 16, borderWidth: 1, borderColor: C.border },
  label: { color: C.textMuted, fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, marginRight: 8, marginBottom: 4 },
  chipText: { fontSize: 13, color: C.textMuted, fontWeight: "bold" },
  stepItem: { flexDirection: "row", alignItems: "center", marginBottom: 8, backgroundColor: C.surfaceLight, padding: 10, borderRadius: 8 },
  stepNum: { color: C.amber, fontSize: 14, fontWeight: "bold", width: 20, textAlign: "center", marginRight: 10 },
  stepItemText: { flex: 1, color: C.text, fontSize: 14 },
  stepRemove: { color: C.red, fontSize: 18, fontWeight: "bold", paddingHorizontal: 4 },
  stepRow: { flexDirection: "row", marginBottom: 16 },
  stepInput: { flex: 1, backgroundColor: C.surfaceLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  stepAddBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: C.surfaceLight, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  stepAddBtnText: { color: C.amber, fontSize: 20, fontWeight: "bold" },
  addBtn: { backgroundColor: C.amber, paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 4 },
  addBtnDisabled: { backgroundColor: C.surfaceLight },
  addBtnText: { color: C.white, fontSize: 16, fontWeight: "bold" },
  feedback: { backgroundColor: "rgba(39,174,96,0.15)", borderRadius: 10, padding: 12, marginTop: 12 },
  feedbackText: { color: C.green, fontSize: 13, fontWeight: "bold" },
  recent: { marginTop: 24 },
  recentTitle: { color: C.textDim, fontSize: 12, fontWeight: "bold", marginBottom: 10 },
  recentItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface },
  recentDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  recentText: { flex: 1, color: C.textMuted, fontSize: 14 },
  recentTextDone: { textDecorationLine: "line-through", color: C.textDim },
  recentDone: { color: C.green, fontSize: 14, fontWeight: "bold" },
});
