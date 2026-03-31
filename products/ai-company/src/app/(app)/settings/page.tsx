"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { mockCompany } from "@/data/mock";
import * as api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import Nango from "@nangohq/frontend";
import type { SNSAccount, SNSPlatform } from "@/types";

type SettingsTab = "general" | "rules" | "messaging" | "apps" | "integrations" | "connectors";

interface ConnectorData {
  id: string;
  provider: string;
  config: Record<string, string>;
  enabled: boolean;
  webhookPath: string;
  status?: string;
  createdAt?: string;
}

interface ProviderInfo {
  id: string;
  type: "webhook" | "oauth";
  name: string;
  description: string;
  color: string;
  bgColor: string;
  iconSvg: string;
  fields: { key: string; label: string; type: string; required: boolean }[];
  auth: { type?: string; provider?: string; scopes?: string[] };
}

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [form, setForm] = useState({
    name: mockCompany.name,
    industry: mockCompany.industry,
    mission: mockCompany.mission,
    goals: mockCompany.goals,
  });

  // Provider state (loaded from plugin system)
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  // Connector state
  const [connectors, setConnectors] = useState<Record<string, ConnectorData>>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [googleStatus, setGoogleStatus] = useState<Record<string, { connected: boolean }>>({});

  const fetchConnectors = useCallback(async () => {
    try {
      const res = await fetch("/api/connectors");
      const data = await res.json();
      if (data.connectors) {
        setConnectors(data.connectors);
        setPublicUrl(data.publicUrl || null);
      } else if (!data.error) {
        setConnectors(data);
      }
    } catch {}
    // Google OAuth status
    try {
      const gRes = await fetch("/api/connectors?_action=google-status");
      const gData = await gRes.json();
      if (!gData.error) setGoogleStatus(gData);
    } catch {}
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  useEffect(() => {
    fetch(`/api/connectors/providers?locale=${locale}`)
      .then(r => r.json())
      .then(data => { if (data.providers) setProviders(data.providers); })
      .catch(() => {});
  }, [locale]);

  // Find connector for a given provider
  const getConnectorForProvider = (provider: string): ConnectorData | undefined =>
    Object.values(connectors).find((c) => c.provider === provider);

  // When expanding a provider, populate edit fields from saved config
  const expandProvider = (provider: string) => {
    if (expandedProvider === provider) {
      setExpandedProvider(null);
      return;
    }
    setExpandedProvider(provider);
    const conn = getConnectorForProvider(provider);
    setEditFields(conn?.config || {});
  };

  const saveConnector = async (provider: string) => {
    setSaving(true);
    const existing = getConnectorForProvider(provider);
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: existing?.id,
          provider,
          config: editFields,
        }),
      });
      await res.json();
      await fetchConnectors();
    } catch {}
    setSaving(false);
  };

  const toggleConnector = async (provider: string, action: "start" | "stop") => {
    const conn = getConnectorForProvider(provider);
    if (!conn) return;
    setSaving(true);
    setVerifyResult(null);
    try {
      await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: action, connectorId: conn.id }),
      });
      await fetchConnectors();
    } catch {}
    setSaving(false);
  };

  const copyWebhookUrl = (path: string) => {
    const baseUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8000` : "";
    navigator.clipboard.writeText(`${baseUrl}${path}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fieldLabel = (key: string): string => {
    const map: Record<string, string> = {
      channelId: t.settings.connectors.channelId,
      channelSecret: t.settings.connectors.secretKey,
      accessToken: t.settings.connectors.accessToken,
      botToken: t.settings.connectors.botToken,
      serverId: t.settings.connectors.serverId,
    };
    return map[key] || key;
  };

  const getProviderInfo = (providerId: string): ProviderInfo | undefined =>
    providers.find((p) => p.id === providerId);

  const connectorName = (provider: string) => {
    const prov = getProviderInfo(provider);
    if (prov) return prov.name;
    const c = t.settings.connectors as Record<string, { name?: string; description?: string } | undefined>;
    return c[provider]?.name ?? provider;
  };
  const connectorDesc = (provider: string) => {
    const prov = getProviderInfo(provider);
    if (prov) return prov.description;
    const c = t.settings.connectors as Record<string, { name?: string; description?: string } | undefined>;
    return c[provider]?.description ?? "";
  };
  const isOAuthProvider = (provider: string) => {
    const prov = getProviderInfo(provider);
    return prov ? prov.type === "oauth" : false;
  };

  // Rules state
  const [companyRules, setCompanyRules] = useState("");
  const [companyRulesLoaded, setCompanyRulesLoaded] = useState(false);
  const [deptList, setDeptList] = useState<{ id: string; hasRules: boolean }[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [deptRules, setDeptRules] = useState("");
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);

  const DEPT_LABELS: Record<string, { ja: string; en: string }> = {
    "general-affairs": { ja: "総務・秘書室", en: "General Affairs" },
    accounting: { ja: "経理", en: "Accounting" },
    engineering: { ja: "エンジニアリング", en: "Engineering" },
    dev: { ja: "開発", en: "Development" },
    pm: { ja: "PM", en: "PM" },
    research: { ja: "リサーチ", en: "Research" },
    sales: { ja: "営業", en: "Sales" },
    newbiz: { ja: "新規事業", en: "New Business" },
    sns: { ja: "SNS運用", en: "SNS" },
  };

  useEffect(() => {
    if (activeTab === "rules" && !companyRulesLoaded) {
      fetch("/api/rules?type=company").then(r => r.json()).then(d => {
        setCompanyRules(d.content || "");
        setCompanyRulesLoaded(true);
      }).catch(() => {});
      fetch("/api/rules?type=departments").then(r => r.json()).then(d => {
        if (d.departments) setDeptList(d.departments);
      }).catch(() => {});
    }
  }, [activeTab, companyRulesLoaded]);

  useEffect(() => {
    if (selectedDept) {
      fetch(`/api/rules?type=department&id=${selectedDept}`).then(r => r.json()).then(d => {
        setDeptRules(d.content || "");
      }).catch(() => {});
    }
  }, [selectedDept]);

  const saveRules = async (type: "company" | "department", id?: string) => {
    setRulesSaving(true);
    setRulesSaved(false);
    try {
      await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          id,
          content: type === "company" ? companyRules : deptRules,
        }),
      });
      setRulesSaved(true);
      setTimeout(() => setRulesSaved(false), 2000);
    } catch {}
    setRulesSaving(false);
  };

  // SNS Integrations
  const [snsAccounts, setSnsAccounts] = useState<SNSAccount[]>([]);

  useEffect(() => {
    api.getSNSAccounts().then(setSnsAccounts);
  }, []);

  const platformConfig: Record<SNSPlatform, { name: string; color: string; bg: string }> = {
    note: { name: "note.com", color: "var(--color-success)", bg: "var(--color-success-light)" },
    threads: { name: "Threads", color: "var(--color-text)", bg: "var(--color-border-light)" },
    line: { name: "LINE", color: "#06C755", bg: "#06C75515" },
    x: { name: "X", color: "var(--color-text)", bg: "var(--color-border-light)" },
    instagram: { name: "Instagram", color: "var(--color-danger)", bg: "var(--color-danger-light)" },
  };

  // Nango connections (deduplicated by provider_config_key — keep latest)
  const [nangoConnections, setNangoConnections] = useState<{ connection_id: string; provider: string; provider_config_key: string }[]>([]);
  const loadNangoConnections = useCallback(() => {
    fetch("/api/nango/connections").then(r => r.json()).then(d => {
      if (d.connections) {
        // provider_config_key で重複排除（最新のみ保持）
        const seen = new Map<string, typeof d.connections[0]>();
        for (const c of d.connections) {
          seen.set(c.provider_config_key, c);
        }
        setNangoConnections(Array.from(seen.values()));
      }
    }).catch(() => {});
  }, []);
  useEffect(() => { loadNangoConnections(); }, [loadNangoConnections]);

  const MESSAGING_PROVIDERS = ["line", "slack", "discord"];

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "general", label: t.settings.tabs.general },
    { key: "rules", label: locale === "ja" ? "ルール" : "Rules" },
    { key: "messaging", label: locale === "ja" ? "連絡連携" : "Messaging" },
    { key: "apps", label: locale === "ja" ? "アプリ連携" : "Apps" },
  ];

  return (
    <>
    <div className="max-w-4xl px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.settings.title}</h1>
        <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.settings.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-subtext)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <>
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 mb-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-5">{t.settings.companyProfile}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.companyName}</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.industry}</label>
                <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.mission}</label>
                <textarea value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t.settings.goals}</label>
                <textarea value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow resize-none" />
              </div>
              <button className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">{t.common.save}</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 mb-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-4">{t.settings.plan}</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-semibold rounded-full">{t.settings.free}</span>
                <span className="text-sm text-[var(--color-subtext)]">{t.settings.upTo.replace("{n}", "2")}</span>
              </div>
              <button className="px-4 py-2 bg-white border border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-primary-light)] transition-colors">{t.settings.upgrade}</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-4">{t.settings.data}</h2>
            <button className="px-4 py-2 bg-white border border-[var(--color-border)] text-[var(--color-text)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-light)] transition-colors">{t.common.export}</button>
          </div>

          {/* AI Profile */}
          <ProfileSection locale={locale} />
        </>
      )}

      {/* Rules Tab */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          {/* Company-wide Rules */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-[var(--color-text)]">
                  {locale === "ja" ? "全社共通ルール" : "Company-wide Rules"}
                </h2>
                <p className="text-xs text-[var(--color-subtext)] mt-0.5">
                  {locale === "ja" ? "全社員が従う共通ルール (CLAUDE.md)" : "Rules all employees follow (CLAUDE.md)"}
                </p>
              </div>
              <button
                onClick={() => saveRules("company")}
                disabled={rulesSaving}
                className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
              >
                {rulesSaving ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : rulesSaved ? (
                  locale === "ja" ? "保存しました" : "Saved"
                ) : (
                  t.common.save
                )}
              </button>
            </div>
            <textarea
              value={companyRules}
              onChange={(e) => setCompanyRules(e.target.value)}
              rows={16}
              className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow resize-y leading-relaxed"
              placeholder={locale === "ja" ? "Markdown で記述..." : "Write in Markdown..."}
            />
          </div>

          {/* Department Rules */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-1">
              {locale === "ja" ? "部署別ルール" : "Department Rules"}
            </h2>
            <p className="text-xs text-[var(--color-subtext)] mb-4">
              {locale === "ja" ? "各部署固有のルール (部署CLAUDE.md)" : "Rules specific to each department"}
            </p>

            {/* Department chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {deptList.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(selectedDept === dept.id ? null : dept.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    selectedDept === dept.id
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-border-light)]"
                  }`}
                >
                  {DEPT_LABELS[dept.id]?.[locale] || dept.id}
                </button>
              ))}
            </div>

            {/* Department editor */}
            {selectedDept && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {DEPT_LABELS[selectedDept]?.[locale] || selectedDept}
                  </h3>
                  <button
                    onClick={() => saveRules("department", selectedDept)}
                    disabled={rulesSaving}
                    className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
                  >
                    {rulesSaving ? (
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    ) : rulesSaved ? (
                      locale === "ja" ? "保存しました" : "Saved"
                    ) : (
                      t.common.save
                    )}
                  </button>
                </div>
                <textarea
                  value={deptRules}
                  onChange={(e) => setDeptRules(e.target.value)}
                  rows={14}
                  className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow resize-y leading-relaxed"
                  placeholder={locale === "ja" ? "Markdown で記述..." : "Write in Markdown..."}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === "integrations" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-[var(--color-subtext)]">{t.sns.subtitle}</p>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t.sns.connectAccount}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-border)]">
            {snsAccounts.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-[var(--color-subtext)]">{t.sns.noAccounts}</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {snsAccounts.map((acc) => {
                  const config = platformConfig[acc.platform];
                  return (
                    <div key={acc.id} className="flex items-center gap-4 px-6 py-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: config.bg, color: config.color }}
                      >
                        {config.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--color-text)]">{config.name}</p>
                        <p className="text-xs text-[var(--color-subtext)]">{acc.accountName}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        acc.sessionValid
                          ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
                          : "bg-[var(--color-danger-light)] text-[var(--color-danger)]"
                      }`}>
                        {acc.sessionValid ? t.sns.connected : t.sns.reconnect}
                      </span>
                      <button className="text-[var(--color-subtext)] hover:text-[var(--color-text)] transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connectors Tab */}
      {/* Messaging — LINE/Slack/Discord */}
      {activeTab === "messaging" && (
        <div>
          <p className="text-sm text-[var(--color-subtext)] mb-6">
            {locale === "ja" ? "LINE・Slack・Discord のWebhook連携を設定します" : "Configure messaging webhook integrations"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {providers.filter((p) => MESSAGING_PROVIDERS.includes(p.id)).map((prov) => {
              const conn = getConnectorForProvider(prov.id);
              const isRunning = conn?.status === "running";
              const isConfigured = conn?.enabled;
              return (
                <button key={prov.id} onClick={() => expandProvider(prov.id)}
                  className={`bg-white rounded-xl border p-5 text-left transition-all hover:shadow-md ${expandedProvider === prov.id ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20" : "border-[var(--color-border)]"}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center [&>svg]:w-7 [&>svg]:h-7" style={{ backgroundColor: prov.bgColor, color: prov.color }} dangerouslySetInnerHTML={{ __html: prov.iconSvg }} />
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${isRunning ? "bg-green-50 text-green-600" : isConfigured ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-[var(--color-subtext)]"}`}>
                      {isRunning ? (locale === "ja" ? "稼働中" : "Running") : isConfigured ? (locale === "ja" ? "停止中" : "Stopped") : (locale === "ja" ? "未接続" : "Not connected")}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[var(--color-text)] text-sm">{prov.name}</h3>
                  <p className="text-xs text-[var(--color-subtext)] mt-1 line-clamp-2">{prov.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Apps — Nango Service Integrations */}
      {activeTab === "apps" && (() => {
        const openNangoConnect = async (integrationId?: string) => {
          try {
            const nango = new Nango();
            const connect = nango.openConnectUI({
              onEvent: (event) => {
                if (event.type === "connect") {
                  loadNangoConnections();
                }
              },
            });
            const res = await fetch("/api/nango/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ integrationId }),
            });
            const data = await res.json();
            if (data.data?.token) {
              connect.setSessionToken(data.data.token);
            } else if (data.token) {
              connect.setSessionToken(data.token);
            } else {
              console.error("No session token:", data);
            }
          } catch (e) {
            console.error("Nango connect error:", e);
          }
        };

        return (
          <div>
            <p className="text-sm text-[var(--color-subtext)] mb-6">
              {locale === "ja" ? "外部サービスと連携します。OAuth経由で安全に接続されます。" : "Connect external services securely via OAuth."}
            </p>

            {/* Connect New App Button */}
            <button
              onClick={() => openNangoConnect()}
              className="mb-6 inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {locale === "ja" ? "アプリを接続" : "Connect App"}
            </button>

            {/* Connected Apps */}
            {nangoConnections.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">
                  {locale === "ja" ? "接続済み" : "Connected"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {nangoConnections.map((conn) => (
                    <div key={conn.connection_id} className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm text-[var(--color-text)] capitalize">{conn.provider}</h4>
                          <p className="text-[10px] text-[var(--color-subtext)] mt-0.5 font-mono">{conn.provider_config_key}</p>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-50 text-green-600">
                          {locale === "ja" ? "接続済み" : "Connected"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--color-subtext)] mt-6">
              {locale === "ja" ? "250+のサービスに対応。「アプリを接続」から任意のサービスを追加できます。" : "250+ services supported. Click 'Connect App' to add any service."}
            </p>
          </div>
        );
      })()}

    </div>

    {/* Connector Detail Modal */}
    {expandedProvider && (() => {
        const provider = expandedProvider;
        const prov = getProviderInfo(provider);
        const conn = getConnectorForProvider(provider);
        const isRunning = conn?.status === "running";
        const fullUrl = conn?.webhookUrl || (publicUrl && conn?.webhookPath ? `${publicUrl}${conn.webhookPath}` : null);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setExpandedProvider(null); setVerifyResult(null); }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
                    style={{ backgroundColor: prov?.bgColor || "#f3f4f6", color: prov?.color || "#6b7280" }}
                    dangerouslySetInnerHTML={{ __html: prov?.iconSvg || "" }}
                  />
                  <div>
                    <h3 className="font-semibold text-[var(--color-text)]">{prov?.name || provider}</h3>
                    <p className="text-xs text-[var(--color-subtext)]">{prov?.description || ""}</p>
                  </div>
                </div>
                <button onClick={() => { setExpandedProvider(null); setVerifyResult(null); }} className="p-1.5 text-[var(--color-subtext)] hover:text-[var(--color-text)] transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* OAuth Provider — Google Login */}
                {isOAuthProvider(provider) && (
                  <div className="text-center py-4 space-y-4">
                    <p className="text-sm text-[var(--color-subtext)]">
                      {locale === "ja"
                        ? "Googleアカウントでログインして接続します"
                        : "Sign in with your Google account to connect"}
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/connectors?_action=google-auth&provider=${provider}`);
                          const data = await res.json();
                          if (data.url) {
                            window.open(data.url, "_blank", "width=500,height=700");
                          } else {
                            alert(data.error || "Failed to get auth URL");
                          }
                        } catch { alert("Worker not reachable"); }
                      }}
                      className="inline-flex items-center gap-3 px-6 py-3 bg-white border border-[var(--color-border)] rounded-xl text-sm font-medium text-[var(--color-text)] hover:shadow-md transition-shadow"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      {locale === "ja" ? "Google でログイン" : "Sign in with Google"}
                    </button>
                    <p className="text-[10px] text-[var(--color-subtext)]">
                      {locale === "ja"
                        ? "Claude Code の MCP サーバー経由で安全に接続されます"
                        : "Securely connected via Claude Code MCP servers"}
                    </p>
                  </div>
                )}

                {/* Webhook Provider — Config Fields */}
                {!isOAuthProvider(provider) && (prov?.fields || []).map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{field.label || fieldLabel(field.key)}</label>
                    <input
                      type={field.type || "text"}
                      value={editFields[field.key] || ""}
                      onChange={(e) => setEditFields({ ...editFields, [field.key]: e.target.value })}
                      placeholder={field.label || fieldLabel(field.key)}
                      className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow font-mono"
                    />
                  </div>
                ))}

                {/* Webhook URL (webhook providers only) */}
                {!isOAuthProvider(provider) && <div className="p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[var(--color-text)]">Webhook URL</label>
                    <button
                      onClick={async () => {
                        setSaving(true);
                        setVerifyResult(null);
                        await toggleConnector(provider, "start");
                        setSaving(false);
                      }}
                      disabled={saving}
                      className="px-2.5 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 bg-white border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border-light)]"
                    >
                      {saving ? (
                        <span className="w-3 h-3 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin inline-block" />
                      ) : fullUrl ? (
                        locale === "ja" ? "再発行" : "Regenerate"
                      ) : (
                        locale === "ja" ? "発行" : "Generate"
                      )}
                    </button>
                  </div>
                  {fullUrl ? (
                    <>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-2 py-1.5 bg-white border border-[var(--color-border)] rounded text-[11px] font-mono text-[var(--color-text)] overflow-x-auto">
                          {fullUrl}
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                          className="px-2 py-1.5 bg-white border border-[var(--color-border)] rounded text-xs hover:bg-[var(--color-border-light)] transition-colors shrink-0"
                        >
                          {copied ? "OK" : (locale === "ja" ? "コピー" : "Copy")}
                        </button>
                      </div>
                      <p className="text-[10px] text-[var(--color-subtext)] mt-1.5">
                        {locale === "ja" ? "この URL を各サービスの管理画面に設定してください" : "Set this URL in your service dashboard"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--color-subtext)]">
                      {locale === "ja" ? "「発行」ボタンで Webhook URL を生成します" : "Click Generate to create a Webhook URL"}
                    </p>
                  )}
                </div>}

                {/* Verify Result */}
                {verifyResult && (
                  <div className={`p-3 rounded-lg border text-sm ${
                    verifyResult.status === "ok" ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {verifyResult.status === "ok" ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                      )}
                      <span className="font-medium text-xs">
                        {verifyResult.status === "ok" ? (locale === "ja" ? "接続確認OK" : "Verified") : (locale === "ja" ? "確認結果" : "Result")}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div>Webhook: {verifyResult.webhookReachable ? "OK" : (verifyResult.webhookError || "NG")}</div>
                      {verifyResult.botVerified !== undefined && (
                        <div>Bot: {verifyResult.botVerified ? `OK (${verifyResult.botName || ""})` : (verifyResult.botError || "NG")}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-3 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
                {!isOAuthProvider(provider) && <button
                  onClick={() => saveConnector(provider)}
                  disabled={saving}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </span>
                  ) : t.common.save}
                </button>}

                {!isOAuthProvider(provider) && conn && (
                  isRunning ? (
                    <button
                      onClick={() => toggleConnector(provider, "stop")}
                      disabled={saving}
                      className="px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {t.settings.connectors.disconnect}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await toggleConnector(provider, "start");
                        // 接続後に自動で疎通確認
                        const updated = getConnectorForProvider(provider);
                        if (updated) {
                          setSaving(true);
                          try {
                            const res = await fetch("/api/connectors", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ _action: "verify", connectorId: updated.id }),
                            });
                            setVerifyResult(await res.json());
                          } catch { setVerifyResult({ status: "error", webhookError: "Failed" }); }
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      className="px-4 py-2 bg-white border border-green-200 text-green-600 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
                    >
                      {t.settings.connectors.connect}
                    </button>
                  )
                )}

                {/* Verify button — only shown when connected */}
                {conn && isRunning && (
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const res = await fetch("/api/connectors", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ _action: "verify", connectorId: conn.id }),
                        });
                        setVerifyResult(await res.json());
                      } catch { setVerifyResult({ status: "error", webhookError: "Failed" }); }
                      setSaving(false);
                    }}
                    disabled={saving}
                    className="px-4 py-2 bg-white border border-blue-200 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    {locale === "ja" ? "疎通確認" : "Verify"}
                  </button>
                )}

                <div className="ml-auto flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-green-400 animate-pulse" : "bg-gray-300"}`} />
                  <span className="text-xs text-[var(--color-subtext)]">
                    {isRunning ? (locale === "ja" ? "稼働中" : "Running") : (locale === "ja" ? "停止" : "Stopped")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
    })()}
    </>
  );
}

// --- AI Profile Section ---
function ProfileSection({ locale }: { locale: string }) {
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editJson, setEditJson] = useState("");

  useEffect(() => {
    fetch("/api/user/profile").then(r => r.json()).then(d => {
      setProfile(d);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    try {
      const parsed = JSON.parse(editJson);
      await fetch("/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: editJson });
      setProfile(parsed);
      setEditing(false);
    } catch {}
  };

  const reset = async () => {
    await fetch("/api/user/profile", { method: "DELETE" });
    setProfile({});
  };

  const keys = Object.keys(profile).filter(k => !k.startsWith("_"));

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-[var(--color-text)]">
            {locale === "ja" ? "AIが学んだあなたの情報" : "What AI learned about you"}
          </h2>
          <p className="text-xs text-[var(--color-subtext)] mt-0.5">
            {locale === "ja" ? "会話を通じて自動的に蓄積されます（5回ごとに更新）" : "Automatically learned through conversations"}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing && keys.length > 0 && (
            <button onClick={() => { setEditJson(JSON.stringify(profile, null, 2)); setEditing(true); }}
              className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-light)] transition-colors">
              {locale === "ja" ? "編集" : "Edit"}
            </button>
          )}
          {keys.length > 0 && (
            <button onClick={reset}
              className="px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] border border-[var(--color-border)] rounded-lg hover:bg-red-50 transition-colors">
              {locale === "ja" ? "リセット" : "Reset"}
            </button>
          )}
        </div>
      </div>

      {!loaded ? (
        <div className="text-sm text-[var(--color-subtext)]">{locale === "ja" ? "読み込み中..." : "Loading..."}</div>
      ) : editing ? (
        <div>
          <textarea value={editJson} onChange={(e) => setEditJson(e.target.value)} rows={12}
            className="w-full px-3 py-2 font-mono text-xs border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-y" />
          <div className="flex gap-2 mt-2">
            <button onClick={save} className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg">{locale === "ja" ? "保存" : "Save"}</button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg">{locale === "ja" ? "キャンセル" : "Cancel"}</button>
          </div>
        </div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-[var(--color-subtext)] py-4 text-center">
          {locale === "ja" ? "まだ情報がありません。社員とチャットすると自動で蓄積されます。" : "No data yet. Chat with employees to start learning."}
        </p>
      ) : (
        <div className="space-y-2">
          {keys.map(k => {
            const v = profile[k];
            return (
              <div key={k} className="flex items-start gap-3 py-1.5">
                <span className="text-xs font-medium text-[var(--color-subtext)] w-28 shrink-0">{k}</span>
                <span className="text-sm text-[var(--color-text)]">
                  {Array.isArray(v) ? (v as unknown[]).map((item, i) => (
                    typeof item === "object" && item !== null
                      ? <span key={i} className="block text-xs text-[var(--color-subtext)]">{JSON.stringify(item)}</span>
                      : <span key={i} className="inline-block mr-1.5 px-2 py-0.5 bg-[var(--color-border-light)] text-xs rounded">{String(item)}</span>
                  )) : String(v)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
