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

// --- Employees ---
export async function getEmployees(): Promise<Employee[]> {
  return mockEmployees;
}

export async function getEmployee(id: string): Promise<Employee | null> {
  return mockEmployees.find((e) => e.id === id) ?? null;
}

export async function createEmployee(
  data: Partial<Employee>
): Promise<Employee> {
  return {
    ...mockEmployees[0],
    id: `emp-${Date.now()}`,
    ...data,
  } as Employee;
}

export async function updateEmployee(
  id: string,
  data: Partial<Employee>
): Promise<Employee> {
  const employee = mockEmployees.find((e) => e.id === id);
  return { ...employee!, ...data };
}

// --- Tasks ---
export async function getTasks(employeeId?: string): Promise<Task[]> {
  if (employeeId) {
    return mockTasks.filter((t) => t.employeeId === employeeId);
  }
  return mockTasks;
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
  return mockScheduleEvents;
}
