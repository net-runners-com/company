export type Plan = "free" | "lite" | "pro" | "business";

export type DepartmentCategory = "front-office" | "back-office" | "management";

export interface Department {
  id: string;
  category: DepartmentCategory;
  name: string;
  nameJa: string;
}

export type EmployeeStatus = "active" | "paused" | "archived";
export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "high" | "normal" | "low";
export type QueueStatus = "queued" | "processing" | "done" | "failed";
export type QueueType = "text" | "browser";
export type SNSPlatform = "note" | "threads" | "line" | "x" | "instagram";
export type ActivityType = "chat" | "task" | "sns_post" | "error" | "system";

export interface User {
  id: string;
  displayName: string;
  plan: Plan;
  createdAt: string;
}

export interface Company {
  id: string;
  userId: string;
  name: string;
  industry: string;
  mission: string;
  goals: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  companyId: string;
  name: string;
  role: string;
  department: string;
  personality: Record<string, unknown>;
  tone: string;
  skills: string[];
  systemPrompt: string;
  avatarUrl: string | null;
  status: EmployeeStatus;
  sortOrder: number;
  greeting: string;
  createdAt: string;
}

export interface Task {
  id: string;
  companyId: string;
  employeeId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  parentTaskId: string | null;
  nextEmployeeId: string | null;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskQueueItem {
  id: string;
  companyId: string;
  employeeId: string;
  type: QueueType;
  action: string;
  payload: Record<string, unknown>;
  status: QueueStatus;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  executedAt: string | null;
}

export interface SNSAccount {
  id: string;
  companyId: string;
  platform: SNSPlatform;
  accountName: string;
  profileName: string;
  sessionValid: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  employeeId: string | null;
  type: ActivityType;
  summary: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type DocumentType = "estimate" | "invoice";
export type DocumentStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface Document {
  id: string;
  companyId: string;
  type: DocumentType;
  number: string;
  clientName: string;
  subject: string;
  items: DocumentItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: DocumentStatus;
  issueDate: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface DocumentItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export type ProjectStatus = "active" | "completed" | "on_hold" | "cancelled";

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string;
  clientName: string;
  status: ProjectStatus;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string | null;
  members: string[]; // employee IDs
  createdAt: string;
}

export interface ScheduleEvent {
  id: string;
  companyId: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "meeting" | "deadline" | "review" | "other";
  employeeIds: string[];
  createdAt: string;
}
