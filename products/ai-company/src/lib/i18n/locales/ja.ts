import type { Translations } from "./en";

const ja: Translations = {
  // Common
  common: {
    save: "保存する",
    back: "戻る",
    continue: "次へ",
    cancel: "キャンセル",
    add: "追加",
    send: "送信",
    delete: "削除",
    export: "データをエクスポート",
    viewAll: "すべて見る",
    active: "稼働中",
    noData: "まだデータがありません。",
  },

  // Navigation
  nav: {
    dashboard: "ダッシュボード",
    analytics: "分析",
    integrations: "連携",
    activity: "アクティビティ",
    projects: "プロジェクト",
    tasks: "タスク",
    schedule: "スケジュール",
    revenue: "売上",
    documents: "書類",
    settings: "設定",
    secretary: "秘書室",
    employees: "社員",
    finance: "財務",
    sales: "営業",
  },

  // Landing
  landing: {
    tagline: "AI社員があなたのビジネスをサポート。",
    description: "秘書、ライター、リサーチャー、営業を一元管理。",
    getStarted: "はじめる",
    signIn: "ログイン",
  },

  // Home / Dashboard
  home: {
    greeting: "こんにちは、{name}さん",
    slow: "今日は穏やかな一日です。",
    morning: "今日も生産的な朝ですね。",
    afternoon: "忙しい午後ですね。",
    evening: "穏やかな夕方です。",
    night: "静かな夜ですね。",
    addEmployee: "社員を追加",
    totalEmployees: "社員数",
    tasksDone: "完了タスク",
    inProgress: "進行中",
    totalTasks: "総タスク",
    teammates: "チームメンバー",
    recentActivity: "最近のアクティビティ",
  },

  // Analytics
  analytics: {
    title: "分析",
    subtitle: "AIチームのパフォーマンス概要",
    employees: "社員数",
    tasksDone: "完了タスク",
    inProgress: "進行中",
    snsPosts: "SNS投稿",
    activityOverview: "アクティビティ推移",
    recentEvents: "最近のイベント",
    week: "週",
    month: "月",
    year: "年",
    revenue: "売上",
    revenueSubtitle: "期間別の売上推移",
    totalRevenue: "総売上",
    monthlyAvg: "月平均",
    thisMonth: "今月",
    growth: "成長率",
  },

  // Activity
  activity: {
    title: "アクティビティ",
    subtitle: "チーム全体の最近のイベント",
    types: {
      chat: "チャット",
      task: "タスク",
      sns_post: "投稿",
      error: "エラー",
      system: "システム",
    },
  },

  // SNS / Integrations
  sns: {
    title: "連携",
    subtitle: "接続済みのSNSアカウントを管理",
    connectAccount: "アカウントを連携",
    connected: "接続中",
    reconnect: "再接続",
    noAccounts: "連携済みのアカウントはありません。",
  },

  // Documents
  documents: {
    title: "書類",
    subtitle: "見積書・請求書を管理",
    all: "すべて",
    estimates: "見積書",
    invoices: "請求書",
    createEstimate: "見積書を作成",
    createInvoice: "請求書を作成",
    noDocuments: "書類はまだありません。",
    client: "クライアント",
    subject: "件名",
    amount: "金額",
    status: "ステータス",
    issueDate: "発行日",
    dueDate: "支払期限",
    docStatus: {
      draft: "下書き",
      sent: "送付済",
      paid: "入金済",
      overdue: "期限超過",
      cancelled: "キャンセル",
    },
    docType: {
      estimate: "見積書",
      invoice: "請求書",
    },
  },

  // Projects
  projects: {
    title: "プロジェクト",
    subtitle: "プロジェクト管理と進捗確認",
    all: "すべて",
    active: "進行中",
    completed: "完了",
    onHold: "保留",
    createProject: "新規プロジェクト",
    noProjects: "プロジェクトはまだありません。",
    client: "クライアント",
    budget: "予算",
    spent: "使用済",
    progress: "進捗",
    members: "メンバー",
    startDate: "開始日",
    endDate: "終了日",
    projectStatus: {
      active: "進行中",
      completed: "完了",
      on_hold: "保留",
      cancelled: "中止",
    },
  },

  // Tasks
  tasks: {
    title: "タスク",
    subtitle: "チーム全体のタスクを管理・追跡",
    all: "すべて",
    pending: "未着手",
    inProgress: "進行中",
    done: "完了",
    createTask: "新規タスク",
    noTasks: "タスクはまだありません。",
    assignee: "担当者",
    priority: "優先度",
    dueDate: "期限",
    priorityLabel: {
      high: "高",
      normal: "中",
      low: "低",
    },
  },

  // Schedule
  schedule: {
    title: "スケジュール",
    subtitle: "チームカレンダーと予定",
    today: "今日",
    upcoming: "今後の予定",
    noEvents: "予定はありません。",
    createEvent: "新規予定",
    eventType: {
      meeting: "ミーティング",
      deadline: "締切",
      review: "レビュー",
      other: "その他",
    },
  },

  // Settings
  settings: {
    title: "設定",
    subtitle: "会社プロフィールと環境設定を管理",
    companyProfile: "会社情報",
    companyName: "会社名",
    industry: "業種",
    mission: "ミッション",
    goals: "目標",
    plan: "プラン",
    free: "Free",
    upTo: "社員{n}人まで",
    upgrade: "アップグレード",
    data: "データ",
  },

  // Onboarding
  onboarding: {
    steps: ["会社情報", "ミッション", "完了"],
    step1Title: "あなたの会社について教えてください",
    step1Subtitle: "あとから変更できます。",
    step2Title: "目標を設定しましょう",
    step2Subtitle: "AI社員の行動指針になります。",
    step3Title: "準備完了！",
    step3Subtitle: "最初のAI社員「さくら」が待っています。\nスケジュールやタスクの管理をお手伝いします。",
    companyName: "会社名",
    companyPlaceholder: "ひまわり商店",
    industryPlaceholder: "EC・物販、コンサル、デザイン...",
    missionPlaceholder: "日々の暮らしを少しだけ豊かにする",
    goalsLabel: "いまの目標",
    goalsPlaceholder: "月商100万を達成する",
    goToDashboard: "ダッシュボードへ",
  },

  // Employee
  employee: {
    roles: {
      Secretary: "秘書",
      Writer: "ライター",
      Researcher: "リサーチャー",
      Sales: "営業",
      Accounting: "経理",
      Designer: "デザイナー",
      Engineer: "エンジニア",
    },
    roleLabel: {
      "ひしょ": "秘書",
      "ライター": "ライター",
      "リサーチャー": "リサーチャー",
      "えいぎょう": "営業",
      "エンジニア": "エンジニア",
      "DevOpsエンジニア": "DevOpsエンジニア",
      "けいり": "経理",
      "PM": "PM",
      "ストラテジスト": "ストラテジスト",
      "じんじ": "人事",
      "しんきじぎょう": "新規事業",
      "ざいむ": "財務",
    } as Record<string, string>,
    status: {
      active: "稼働中",
      paused: "休止中",
      archived: "アーカイブ",
    },
    taskStatus: {
      pending: "未着手",
      in_progress: "進行中",
      done: "完了",
      cancelled: "中止",
    },
    createTitle: "新しい社員を追加",
    createSubtitle: "AIチームメンバーを設定",
    name: "名前",
    namePlaceholder: "さくら",
    role: "役割",
    selectRole: "役割を選択",
    department: "部署",
    departmentPlaceholder: "コンテンツ、調査、営業...",
    personalityTitle: "性格とスキル",
    personalitySubtitle: "働き方をカスタマイズ",
    commStyle: "口調",
    selectStyle: "口調を選択",
    skills: "スキル",
    skillsPlaceholder: "記事執筆、市場調査...",
    createEmployee: "社員を作成",
    chat: "チャット",
    tasks: "タスク",
    noTasks: "まだタスクはありません。",
    startConversation: "{name}と会話をはじめましょう",
    messagePlaceholder: "{name}にメッセージ...",
    tones: ["丁寧", "フレンドリー", "知的", "元気", "クール", "おっとり"],
  },

  // Departments
  departments: {
    categories: {
      "front-office": "フロントオフィス",
      "back-office": "バックオフィス",
      "management": "管理部門",
    },
    names: {
      "sales": "営業部",
      "marketing": "マーケティング部",
      "newbiz": "新規事業部",
      "general-affairs": "総務部",
      "accounting": "経理部",
      "hr": "人事部",
      "dev": "開発部",
      "engineering": "エンジニアリング部",
      "pm": "企画部",
      "research": "調査部",
      "finance": "財務部",
      "strategy": "経営企画部",
    },
  },

  // Time
  time: {
    mAgo: "{n}分前",
    hAgo: "{n}時間前",
    dAgo: "{n}日前",
  },
};

export default ja;
