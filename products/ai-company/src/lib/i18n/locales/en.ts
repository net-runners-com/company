const en = {
  // Common
  common: {
    save: "Save Changes",
    back: "Back",
    continue: "Continue",
    cancel: "Cancel",
    add: "Add",
    send: "Send",
    delete: "Delete",
    export: "Export Data",
    viewAll: "View all",
    active: "active",
    noData: "No data yet.",
  },

  // Navigation
  nav: {
    dashboard: "Dashboard",
    analytics: "Analytics",
    integrations: "Integrations",
    activity: "Activity",
    projects: "Projects",
    tasks: "Tasks",
    schedule: "Schedule",
    revenue: "Revenue",
    documents: "Documents",
    settings: "Settings",
    secretary: "Secretary",
    employees: "Employees",
    finance: "Finance",
    sales: "Sales",
  },

  // Landing
  landing: {
    tagline: "AI employees to support your business.",
    description: "Manage secretaries, writers, researchers, and sales — all in one place.",
    getStarted: "Get Started",
    signIn: "Sign In",
  },

  // Home / Dashboard
  home: {
    greeting: "Hi {name},",
    slow: "It's looking like a slow day.",
    morning: "It's looking like a productive morning.",
    afternoon: "It's looking like a busy afternoon.",
    evening: "It's looking like a calm evening.",
    night: "It's looking like a quiet night.",
    addEmployee: "Add Employee",
    totalEmployees: "Total Employees",
    tasksDone: "Tasks Done",
    inProgress: "In Progress",
    totalTasks: "Total Tasks",
    teammates: "Teammates",
    recentActivity: "Recent Activity",
  },

  // Analytics
  analytics: {
    title: "Analytics",
    subtitle: "Overview of your AI team performance",
    employees: "Employees",
    tasksDone: "Tasks Done",
    inProgress: "In Progress",
    snsPosts: "SNS Posts",
    activityOverview: "Activity Overview",
    recentEvents: "Recent Events",
    week: "Week",
    month: "Month",
    year: "Year",
    revenue: "Revenue",
    revenueSubtitle: "Sales performance over time",
    totalRevenue: "Total Revenue",
    monthlyAvg: "Monthly Avg",
    thisMonth: "This Month",
    growth: "Growth",
  },

  // Activity
  activity: {
    title: "Activity",
    subtitle: "Recent events across your team",
    types: {
      chat: "Chat",
      task: "Task",
      sns_post: "Post",
      error: "Error",
      system: "System",
    },
  },

  // SNS / Integrations
  sns: {
    title: "Integrations",
    subtitle: "Manage your connected social accounts",
    connectAccount: "Connect Account",
    connected: "Connected",
    reconnect: "Reconnect",
    noAccounts: "No accounts connected yet.",
  },

  // Documents
  documents: {
    title: "Documents",
    subtitle: "Manage your estimates and invoices",
    all: "All",
    estimates: "Estimates",
    invoices: "Invoices",
    createEstimate: "New Estimate",
    createInvoice: "New Invoice",
    noDocuments: "No documents yet.",
    client: "Client",
    subject: "Subject",
    amount: "Amount",
    status: "Status",
    issueDate: "Issue Date",
    dueDate: "Due Date",
    docStatus: {
      draft: "Draft",
      sent: "Sent",
      paid: "Paid",
      overdue: "Overdue",
      cancelled: "Cancelled",
    },
    docType: {
      estimate: "Estimate",
      invoice: "Invoice",
    },
  },

  // Projects
  projects: {
    title: "Projects",
    subtitle: "Manage your projects and track progress",
    all: "All",
    active: "Active",
    completed: "Completed",
    onHold: "On Hold",
    createProject: "New Project",
    noProjects: "No projects yet.",
    client: "Client",
    budget: "Budget",
    spent: "Spent",
    progress: "Progress",
    members: "Members",
    startDate: "Start Date",
    endDate: "End Date",
    projectStatus: {
      active: "Active",
      completed: "Completed",
      on_hold: "On Hold",
      cancelled: "Cancelled",
    },
  },

  // Tasks
  tasks: {
    title: "Tasks",
    subtitle: "Manage and track all team tasks",
    all: "All",
    pending: "Pending",
    inProgress: "In Progress",
    done: "Done",
    createTask: "New Task",
    noTasks: "No tasks yet.",
    assignee: "Assignee",
    priority: "Priority",
    dueDate: "Due Date",
    priorityLabel: {
      high: "High",
      normal: "Normal",
      low: "Low",
    },
  },

  // Schedule
  schedule: {
    title: "Schedule",
    subtitle: "Team calendar and upcoming events",
    today: "Today",
    upcoming: "Upcoming",
    noEvents: "No events scheduled.",
    createEvent: "New Event",
    eventType: {
      meeting: "Meeting",
      deadline: "Deadline",
      review: "Review",
      other: "Other",
    },
  },

  // Settings
  settings: {
    title: "Settings",
    subtitle: "Manage your company profile and preferences",
    companyProfile: "Company Profile",
    companyName: "Company Name",
    industry: "Industry",
    mission: "Mission",
    goals: "Goals",
    plan: "Plan",
    free: "Free",
    upTo: "Up to {n} employees",
    upgrade: "Upgrade",
    data: "Data",
  },

  // Onboarding
  onboarding: {
    steps: ["Company", "Mission", "Welcome"],
    step1Title: "Tell us about your company",
    step1Subtitle: "You can change this later.",
    step2Title: "Set your goals",
    step2Subtitle: "This guides your AI employees.",
    step3Title: "You're all set!",
    step3Subtitle: "Your first AI employee \"Sakura\" is ready.\nShe'll help manage your schedule and tasks.",
    companyName: "Company Name",
    companyPlaceholder: "Acme Corp",
    industryPlaceholder: "E-commerce, Consulting, Design...",
    missionPlaceholder: "Making everyday life a little better",
    goalsLabel: "Current Goals",
    goalsPlaceholder: "Reach 1M monthly revenue",
    goToDashboard: "Go to Dashboard",
  },

  // Employee
  employee: {
    roles: {
      Secretary: "Secretary",
      Writer: "Writer",
      Researcher: "Researcher",
      Sales: "Sales",
      Accounting: "Accounting",
      Designer: "Designer",
      Engineer: "Engineer",
    },
    // Japanese role keys for mock data
    roleLabel: {
      "ひしょ": "Secretary",
      "ライター": "Writer",
      "リサーチャー": "Researcher",
      "えいぎょう": "Sales",
      "エンジニア": "Engineer",
      "DevOpsエンジニア": "DevOps Engineer",
      "けいり": "Accountant",
      "PM": "Project Manager",
      "ストラテジスト": "Strategist",
      "じんじ": "HR",
      "しんきじぎょう": "New Business",
      "ざいむ": "Finance",
    } as Record<string, string>,
    status: {
      active: "Active",
      paused: "Paused",
      archived: "Archived",
    },
    taskStatus: {
      pending: "Pending",
      in_progress: "In Progress",
      done: "Done",
      cancelled: "Cancelled",
    },
    // Create page
    createTitle: "Add New Employee",
    createSubtitle: "Set up your AI team member",
    name: "Name",
    namePlaceholder: "Sakura",
    role: "Role",
    selectRole: "Select a role",
    department: "Department",
    departmentPlaceholder: "Content, Research, Sales...",
    personalityTitle: "Personality & Skills",
    personalitySubtitle: "Customize how they work",
    commStyle: "Communication Style",
    selectStyle: "Select a style",
    skills: "Skills",
    skillsPlaceholder: "Article writing, research...",
    createEmployee: "Create Employee",
    // Detail page
    chat: "Chat",
    tasks: "Tasks",
    noTasks: "No tasks assigned yet.",
    // Chat
    startConversation: "Start a conversation with {name}",
    messagePlaceholder: "Message {name}...",
    // Tones
    tones: ["Polite", "Friendly", "Intellectual", "Energetic", "Cool", "Gentle"],
  },

  // Departments
  departments: {
    categories: {
      "front-office": "Front Office",
      "back-office": "Back Office",
      "management": "Management",
    },
    names: {
      "sales": "Sales",
      "marketing": "Marketing",
      "newbiz": "New Business",
      "general-affairs": "General Affairs",
      "accounting": "Accounting",
      "hr": "Human Resources",
      "dev": "Development",
      "engineering": "Engineering",
      "pm": "Project Management",
      "research": "Research",
      "finance": "Finance",
      "strategy": "Strategy",
    },
  },

  // Time
  time: {
    mAgo: "{n}m ago",
    hAgo: "{n}h ago",
    dAgo: "{n}d ago",
  },
};

export default en;

type DeepString<T> = T extends string
  ? string
  : T extends readonly string[]
    ? string[]
    : T extends Record<string, unknown>
      ? { [K in keyof T]: DeepString<T[K]> }
      : T;

export type Translations = DeepString<typeof en>;
