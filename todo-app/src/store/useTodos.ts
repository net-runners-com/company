import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Category } from "../constants/theme";

export interface SubTask {
  id: string;
  text: string;
  done: boolean;
}

export interface Todo {
  id: string;
  text: string;
  category: Category;
  done: boolean;
  createdAt: number;
  completedAt?: number;
  subtasks: SubTask[];
  estimateMin?: number;
}

export interface Stats {
  totalCompleted: number;
  streak: number;
  lastCompletedDate: string;
  level: number;
  xp: number;
}

const TODO_KEY = "@focusdrop_todos";
const STATS_KEY = "@focusdrop_stats";

const getToday = () => new Date().toISOString().split("T")[0];

const defaultStats: Stats = {
  totalCompleted: 0,
  streak: 0,
  lastCompletedDate: "",
  level: 1,
  xp: 0,
};

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(TODO_KEY),
      AsyncStorage.getItem(STATS_KEY),
    ]).then(([todoData, statsData]) => {
      if (todoData) setTodos(JSON.parse(todoData));
      if (statsData) setStats(JSON.parse(statsData));
      setLoaded(true);
    });
  }, []);

  const saveTodos = useCallback((updated: Todo[]) => {
    setTodos(updated);
    AsyncStorage.setItem(TODO_KEY, JSON.stringify(updated));
  }, []);

  const saveStats = useCallback((updated: Stats) => {
    setStats(updated);
    AsyncStorage.setItem(STATS_KEY, JSON.stringify(updated));
  }, []);

  const addTodo = useCallback(
    (text: string, category: Category, estimateMin?: number) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const newTodo: Todo = {
        id: Date.now().toString(),
        text: trimmed,
        category,
        done: false,
        createdAt: Date.now(),
        subtasks: [],
        estimateMin,
      };
      saveTodos([newTodo, ...todos]);
    },
    [todos, saveTodos]
  );

  const toggleDone = useCallback(
    (id: string) => {
      const todo = todos.find((t) => t.id === id);
      if (!todo) return;

      const nowDone = !todo.done;
      const updated = todos.map((t) =>
        t.id === id
          ? { ...t, done: nowDone, completedAt: nowDone ? Date.now() : undefined }
          : t
      );
      saveTodos(updated);

      if (nowDone) {
        const today = getToday();
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        let newStreak = stats.streak;
        if (stats.lastCompletedDate === today) {
          // same day, no streak change
        } else if (stats.lastCompletedDate === yesterday) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
        const newXp = stats.xp + 10;
        const newLevel = Math.floor(newXp / 100) + 1;
        saveStats({
          totalCompleted: stats.totalCompleted + 1,
          streak: newStreak,
          lastCompletedDate: today,
          level: newLevel,
          xp: newXp,
        });
      }
    },
    [todos, stats, saveTodos, saveStats]
  );

  const deleteTodo = useCallback(
    (id: string) => {
      saveTodos(todos.filter((t) => t.id !== id));
    },
    [todos, saveTodos]
  );

  const addSubtask = useCallback(
    (todoId: string, text: string) => {
      const updated = todos.map((t) =>
        t.id === todoId
          ? {
              ...t,
              subtasks: [
                ...t.subtasks,
                { id: Date.now().toString(), text, done: false },
              ],
            }
          : t
      );
      saveTodos(updated);
    },
    [todos, saveTodos]
  );

  const toggleSubtask = useCallback(
    (todoId: string, subId: string) => {
      const updated = todos.map((t) =>
        t.id === todoId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subId ? { ...s, done: !s.done } : s
              ),
            }
          : t
      );
      saveTodos(updated);
    },
    [todos, saveTodos]
  );

  const getNextTask = useCallback(() => {
    return todos.find((t) => !t.done) || null;
  }, [todos]);

  const todayCompleted = todos.filter(
    (t) => t.done && t.completedAt && getToday() === new Date(t.completedAt).toISOString().split("T")[0]
  ).length;

  return {
    todos,
    stats,
    loaded,
    addTodo,
    toggleDone,
    deleteTodo,
    addSubtask,
    toggleSubtask,
    getNextTask,
    todayCompleted,
  };
}
