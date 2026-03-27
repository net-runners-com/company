import { useEffect, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Category = "仕事" | "プライベート" | "買い物";
type FilterType = "全て" | Category;

interface Todo {
  id: string;
  text: string;
  category: Category;
  done: boolean;
  createdAt: number;
}

const STORAGE_KEY = "@todos";
const CATEGORIES: Category[] = ["仕事", "プライベート", "買い物"];
const FILTERS: FilterType[] = ["全て", ...CATEGORIES];
const CATEGORY_COLORS: Record<Category, string> = {
  仕事: "#4A90D9",
  プライベート: "#27AE60",
  買い物: "#E8960F",
};

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("仕事");
  const [filter, setFilter] = useState<FilterType>("全て");
  const [showDone, setShowDone] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) setTodos(JSON.parse(data));
    });
  }, []);

  const save = useCallback((updated: Todo[]) => {
    setTodos(updated);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addTodo = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    save([{ id: Date.now().toString(), text: trimmed, category, done: false, createdAt: Date.now() }, ...todos]);
    setText("");
  };

  const toggleDone = (id: string) => {
    save(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const deleteTodo = (id: string) => {
    Alert.alert("削除", "このタスクを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => save(todos.filter((t) => t.id !== id)) },
    ]);
  };

  const filtered = todos.filter((t) => {
    if (!showDone && t.done) return false;
    if (filter !== "全て" && t.category !== filter) return false;
    return true;
  });

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>TODO</Text>
          <Text style={styles.headerSub}>{remaining} 件の未完了タスク</Text>
        </View>

        <View style={styles.inputArea}>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.categoryChip, category === c && { backgroundColor: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] }]}
                onPress={() => setCategory(c)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryChipText, category === c && styles.categoryChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="新しいタスクを入力..."
              placeholderTextColor="#666"
              value={text}
              onChangeText={setText}
              onSubmitEditing={addTodo}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addBtn, !text.trim() && styles.addBtnDisabled]}
              onPress={addTodo}
              disabled={!text.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filterBar}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={filtered.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>タスクがありません</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.todoItem, item.done && styles.todoItemDone]}>
              <TouchableOpacity style={styles.todoMain} onPress={() => toggleDone(item.id)} activeOpacity={0.7}>
                <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                  {item.done && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.todoContent}>
                  <Text style={[styles.todoText, item.done && styles.todoTextDone]} numberOfLines={2}>{item.text}</Text>
                  <View style={styles.todoMeta}>
                    <View style={[styles.todoCategoryBadge, { backgroundColor: CATEGORY_COLORS[item.category] + "20" }]}>
                      <Text style={[styles.todoCategoryText, { color: CATEGORY_COLORS[item.category] }]}>{item.category}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTodo(item.id)} activeOpacity={0.7}>
                <Text style={styles.deleteBtnText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>{todos.filter((t) => t.done).length}/{todos.length} 完了</Text>
          <TouchableOpacity onPress={() => setShowDone(!showDone)} activeOpacity={0.7}>
            <Text style={styles.footerToggle}>{showDone ? "完了済みを隠す" : "完了済みを表示"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0c1222" },
  container: { flex: 1, backgroundColor: "#0c1222" },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: 2 },
  headerSub: { fontSize: 14, color: "#8b9bb5", marginTop: 4 },
  inputArea: { paddingHorizontal: 20, paddingBottom: 12 },
  categoryRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "#2a3a5c" },
  categoryChipText: { fontSize: 13, color: "#8b9bb5", fontWeight: "600" },
  categoryChipTextActive: { color: "#fff" },
  inputRow: { flexDirection: "row", gap: 10 },
  input: { flex: 1, backgroundColor: "#1a2540", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#fff", borderWidth: 1, borderColor: "#2a3a5c" },
  addBtn: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#c57d12", alignItems: "center", justifyContent: "center" },
  addBtnDisabled: { backgroundColor: "#2a3a5c" },
  addBtnText: { fontSize: 28, color: "#fff", fontWeight: "700", marginTop: -2 },
  filterBar: { flexDirection: "row", paddingHorizontal: 20, gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#1a2540" },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: "#1a2540" },
  filterChipActive: { backgroundColor: "#2a3a5c" },
  filterChipText: { fontSize: 13, color: "#5a6a8a", fontWeight: "600" },
  filterChipTextActive: { color: "#fff" },
  list: { flex: 1 },
  emptyList: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyView: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#5a6a8a", fontSize: 16 },
  todoItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1a2540" },
  todoItemDone: { opacity: 0.5 },
  todoMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: "#2a3a5c", alignItems: "center", justifyContent: "center" },
  checkboxDone: { backgroundColor: "#27AE60", borderColor: "#27AE60" },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  todoContent: { flex: 1 },
  todoText: { fontSize: 16, color: "#e8ecf2", lineHeight: 22 },
  todoTextDone: { textDecorationLine: "line-through", color: "#5a6a8a" },
  todoMeta: { flexDirection: "row", marginTop: 4 },
  todoCategoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  todoCategoryText: { fontSize: 11, fontWeight: "700" },
  deleteBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#1a2540", alignItems: "center", justifyContent: "center", marginLeft: 8 },
  deleteBtnText: { fontSize: 20, color: "#E74C3C", fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#1a2540" },
  footerText: { color: "#5a6a8a", fontSize: 13 },
  footerToggle: { color: "#c57d12", fontSize: 13, fontWeight: "600" },
});
