import { useState } from "react";
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, SafeAreaView, Alert,
} from "react-native";
import { useTodos } from "../src/store/useTodos";
import { C, CATEGORY_COLORS, Category, CATEGORIES } from "../src/constants/theme";

type FilterType = "全て" | Category;
const FILTERS: FilterType[] = ["全て", ...CATEGORIES];

export default function TasksScreen() {
  const { todos, toggleDone, deleteTodo } = useTodos();
  const [filter, setFilter] = useState<FilterType>("全て");
  const [showDone, setShowDone] = useState(true);

  const filtered = todos.filter((t) => {
    if (!showDone && t.done) return false;
    if (filter !== "全て" && t.category !== filter) return false;
    return true;
  });

  const remaining = todos.filter((t) => !t.done).length;
  const completed = todos.filter((t) => t.done).length;

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.container}>
        <Text style={st.title}>📋 すべてのタスク</Text>

        <View style={st.countRow}>
          <View style={st.countBox}>
            <Text style={st.countNum}>{remaining}</Text>
            <Text style={st.countLabel}>未完了</Text>
          </View>
          <View style={st.countBox}>
            <Text style={[st.countNum, { color: C.green }]}>{completed}</Text>
            <Text style={st.countLabel}>完了</Text>
          </View>
          <View style={st.countBox}>
            <Text style={[st.countNum, { color: C.textDim }]}>{todos.length}</Text>
            <Text style={st.countLabel}>合計</Text>
          </View>
        </View>

        <View style={st.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[st.filterChip, filter === f && st.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[st.filterText, filter === f && st.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={st.list}
          contentContainerStyle={filtered.length === 0 ? st.emptyContainer : undefined}
          ListEmptyComponent={
            <View style={st.emptyView}>
              <Text style={st.emptyEmoji}>📭</Text>
              <Text style={st.emptyText}>タスクがありません</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[st.todoItem, item.done && st.todoItemDone]}>
              <TouchableOpacity style={st.todoMain} onPress={() => toggleDone(item.id)}>
                <View style={[st.checkbox, item.done && st.checkboxDone]}>
                  {item.done && <Text style={st.checkmark}>✓</Text>}
                </View>
                <View style={st.todoContent}>
                  <Text style={[st.todoText, item.done && st.todoTextDone]} numberOfLines={2}>{item.text}</Text>
                  <View style={st.todoMeta}>
                    <View style={[st.todoCatBadge, { backgroundColor: CATEGORY_COLORS[item.category] + "20" }]}>
                      <Text style={[st.todoCatText, { color: CATEGORY_COLORS[item.category] }]}>{item.category}</Text>
                    </View>
                    {item.estimateMin != null && <Text style={st.metaText}>⏱ {item.estimateMin}分</Text>}
                    {item.subtasks.length > 0 && <Text style={st.metaText}>📝 {item.subtasks.filter((sub) => sub.done).length}/{item.subtasks.length}</Text>}
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={st.deleteBtn} onPress={() => Alert.alert("削除", "削除しますか？", [{ text: "キャンセル", style: "cancel" }, { text: "削除", style: "destructive", onPress: () => deleteTodo(item.id) }])}>
                <Text style={st.deleteBtnText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <TouchableOpacity style={st.footer} onPress={() => setShowDone(!showDone)}>
          <Text style={st.footerText}>{showDone ? "👁 完了済みを隠す" : "👁 完了済みを表示"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: C.text, marginBottom: 12 },
  countRow: { flexDirection: "row", marginBottom: 16 },
  countBox: { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12, alignItems: "center", marginHorizontal: 4 },
  countNum: { fontSize: 24, fontWeight: "bold", color: C.amber },
  countLabel: { fontSize: 11, color: C.textDim, marginTop: 2, fontWeight: "bold" },
  filterRow: { flexDirection: "row", marginBottom: 12, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: C.surface, marginRight: 8, marginBottom: 4 },
  filterChipActive: { backgroundColor: C.surfaceLight },
  filterText: { fontSize: 13, color: C.textDim, fontWeight: "bold" },
  filterTextActive: { color: C.text },
  list: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyView: { alignItems: "center" },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: C.textDim, fontSize: 16 },
  todoItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.surface },
  todoItemDone: { opacity: 0.45 },
  todoMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: 14 },
  checkboxDone: { backgroundColor: C.green, borderColor: C.green },
  checkmark: { color: C.white, fontSize: 15, fontWeight: "bold" },
  todoContent: { flex: 1 },
  todoText: { fontSize: 16, color: C.text, lineHeight: 22 },
  todoTextDone: { textDecorationLine: "line-through", color: C.textDim },
  todoMeta: { flexDirection: "row", marginTop: 4, flexWrap: "wrap" },
  todoCatBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  todoCatText: { fontSize: 11, fontWeight: "bold" },
  metaText: { color: C.textDim, fontSize: 11, marginRight: 8 },
  deleteBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  deleteBtnText: { fontSize: 20, color: C.red, fontWeight: "bold" },
  footer: { paddingVertical: 12, alignItems: "center" },
  footerText: { color: C.amber, fontSize: 13, fontWeight: "bold" },
});
