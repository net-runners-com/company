/**
 * モックAPIレイヤー
 * 後でSupabase clientに差し替える。関数シグネチャはそのまま維持。
 */
import {
  mockCompany,
  mockEmployees,
  mockTasks,
  mockSNSAccounts,
  mockActivityLogs,
  mockChatMessages,
  mockDocuments,
  mockProjects,
  mockScheduleEvents,
} from "@/data/mock";
import type {
  Company,
  Employee,
  Task,
  SNSAccount,
  ActivityLog,
  ChatMessage,
  Document,
  Project,
  ScheduleEvent,
} from "@/types";

// --- Company ---
export async function getCompany(): Promise<Company | null> {
  return mockCompany;
}

export async function createCompany(
  data: Pick<Company, "name" | "industry" | "mission" | "goals">
): Promise<Company> {
  return { ...mockCompany, ...data };
}

// --- Employees (Worker API) ---
export async function getEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch("/api/employees");
    const data = await res.json();
    if (data && typeof data === "object" && !Array.isArray(data)) {
      // Worker returns { "emp-1": {...}, ... } → convert to array
      return Object.values(data) as Employee[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function getEmployee(id: string): Promise<Employee | null> {
  try {
    const employees = await getEmployees();
    return employees.find((e) => e.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function createEmployee(
  data: Partial<Employee>
): Promise<Employee> {
  const res = await fetch("/api/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateEmployee(
  id: string,
  data: Partial<Employee>
): Promise<Employee> {
  const res = await fetch("/api/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  });
  return res.json();
}

// --- Tasks ---
export async function getTasks(employeeId?: string): Promise<Task[]> {
  if (!employeeId) return [];
  try {
    const res = await fetch(`/api/data/tasks_${employeeId}`);
    const data = await res.json();
    if (data.entries) {
      return data.entries.map((e: Record<string, string>) => ({
        id: e._id || "",
        title: e.title || "",
        description: e.project || "",
        status: e.status === "done" ? "completed" : e.status === "error" ? "cancelled" : "in-progress",
        priority: "medium" as const,
        employeeId,
        createdAt: e.assignedAt || e._created_at || "",
        completedAt: e.completedAt || null,
      }));
    }
  } catch {}
  return [];
}

export async function createTask(data: Partial<Task>): Promise<Task> {
  return {
    ...mockTasks[0],
    id: `task-${Date.now()}`,
    status: "pending",
    ...data,
  } as Task;
}

// --- SNS ---
export async function getSNSAccounts(): Promise<SNSAccount[]> {
  return mockSNSAccounts;
}

// --- Activity ---
export async function getActivityLogs(): Promise<ActivityLog[]> {
  return mockActivityLogs;
}

// --- Chat ---
export async function getChatMessages(
  employeeId: string
): Promise<ChatMessage[]> {
  return mockChatMessages[employeeId] ?? [];
}

export async function sendChatMessage(
  employeeId: string,
  content: string
): Promise<ChatMessage> {
  // 後でSSEストリーミングに差し替え
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content: `（${mockEmployees.find((e) => e.id === employeeId)?.name ?? "AI"}が考え中...）`,
    createdAt: new Date().toISOString(),
  };
}

// --- Dashboard ---
export async function getDashboardStats() {
  const tasks = await getTasks();
  const logs = await getActivityLogs();
  return {
    totalEmployees: mockEmployees.filter((e) => e.status === "active").length,
    tasksDone: tasks.filter((t) => t.status === "done").length,
    tasksInProgress: tasks.filter((t) => t.status === "in_progress").length,
    tasksPending: tasks.filter((t) => t.status === "pending").length,
    snsPostsToday: logs.filter(
      (l) =>
        l.type === "sns_post" &&
        new Date(l.createdAt).toDateString() === new Date().toDateString()
    ).length,
    recentActivity: logs.slice(0, 5),
  };
}

// --- Documents ---
export async function getDocuments(): Promise<Document[]> {
  return mockDocuments;
}

export async function getDocument(id: string): Promise<Document | null> {
  return mockDocuments.find((d) => d.id === id) ?? null;
}

// --- Projects ---
export async function getProjects(): Promise<Project[]> {
  return mockProjects;
}

export async function getProject(id: string): Promise<Project | null> {
  return mockProjects.find((p) => p.id === id) ?? null;
}

// --- Schedule ---
export async function getScheduleEvents(): Promise<ScheduleEvent[]> {
  try {
    const res = await fetch("/api/data/calendar_events");
    const data = await res.json();
    if (data.entries) {
      return data.entries.map((e: Record<string, string>) => ({
        id: e._id || e.id || "",
        title: e.title || "",
        description: e.description || "",
        date: e.date || "",
        startTime: e.startTime || "",
        endTime: e.endTime || "",
        type: e.type || "other",
        employeeIds: e.employeeIds || [],
      }));
    }
  } catch {}
  return [];
}
