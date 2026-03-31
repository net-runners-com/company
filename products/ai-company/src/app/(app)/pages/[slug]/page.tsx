"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Widget {
  type: "metric" | "table" | "text" | "chart" | "list" | "progress" | "iframe" | "links" | "actions";
  label: string;
  collection?: string;
  field?: string;
  content?: string;
  chartType?: "line" | "bar" | "area" | "pie" | "bar_stacked";
  xField?: string;
  yField?: string;
  yFields?: string[];
  colors?: string[];
  height?: number;
  url?: string;
  valueField?: string;
  maxField?: string;
  items?: { label: string; value?: string | number; url?: string; description?: string; method?: string; endpoint?: string; body?: Record<string, unknown> }[];
  linkField?: string;
}

interface PageDef {
  slug: string;
  title: string;
  description?: string;
  widgets: Widget[];
}

// --- Metric Card ---
function MetricCard({ widget }: { widget: Widget }) {
  const [value, setValue] = useState<string>("...");
  useEffect(() => {
    if (!widget.collection) return;
    fetch(`/api/data/${widget.collection}?limit=1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.entries?.[0] && widget.field) setValue(String(d.entries[0][widget.field] ?? "—"));
        else setValue(String(d.count ?? 0));
      })
      .catch(() => setValue("—"));
  }, [widget.collection, widget.field]);

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      <p className="text-xs text-[var(--color-subtext)] mb-1">{widget.label}</p>
      <p className="text-2xl font-bold text-[var(--color-primary)]">{value}</p>
    </div>
  );
}

// --- Data Table ---
function DataTable({ widget }: { widget: Widget }) {
  const [entries, setEntries] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!widget.collection) return;
    fetch(`/api/data/${widget.collection}?limit=20`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [widget.collection]);

  if (loading) return <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 text-sm text-[var(--color-subtext)]">読み込み中...</div>;
  if (entries.length === 0) return <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 text-sm text-[var(--color-subtext)]">データなし — エージェントがデータを投入すると表示されます</div>;

  const keys = Object.keys(entries[0]).filter((k) => !k.startsWith("_"));
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{widget.label}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {keys.map((k) => <th key={k} className="text-left px-4 py-2 font-medium text-[var(--color-subtext)] text-xs">{k}</th>)}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const linkUrl = entry.url || entry.link || (widget.linkField ? entry[widget.linkField] : "");
              const Row = linkUrl ? "a" : "tr";
              return (
                <Row key={i} href={linkUrl ? String(linkUrl) : undefined} target={linkUrl ? "_blank" : undefined} rel={linkUrl ? "noopener noreferrer" : undefined}
                  className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border-light)] ${linkUrl ? "table-row cursor-pointer hover:bg-[var(--color-primary-light)]" : ""}`}>
                  {keys.map((k) => <td key={k} className="px-4 py-2 text-[var(--color-text)]">{String(entry[k] ?? "")}</td>)}
                </Row>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Text Block ---
function TextBlock({ widget }: { widget: Widget }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2">{widget.label}</h3>
      <p className="text-sm text-[var(--color-subtext)] whitespace-pre-wrap">{widget.content || ""}</p>
    </div>
  );
}

// --- Chart (Line / Bar / Area / Pie / Stacked) ---
const CHART_COLORS = ["#7c3aed", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#3b82f6", "#64748b"];

function ChartWidget({ widget }: { widget: Widget }) {
  const [data, setData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!widget.collection) return;
    fetch(`/api/data/${widget.collection}?limit=50`)
      .then((r) => r.json())
      .then((d) => setData((d.entries || []).reverse()))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [widget.collection]);

  const keys = Object.keys(data[0] || {}).filter((k) => !k.startsWith("_"));
  const xKey = widget.xField || keys.find((k) => typeof data[0]?.[k] === "string") || "name";
  const numKeys = keys.filter((k) => k !== xKey && typeof data[0]?.[k] === "number");
  const yFields = widget.yFields || (widget.yField ? [widget.yField] : widget.field ? [widget.field] : numKeys.slice(0, 4));
  const colors = widget.colors || CHART_COLORS;
  const chartHeight = widget.height || 280;

  if (loading) return <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 text-sm text-[var(--color-subtext)]">読み込み中...</div>;
  if (data.length === 0) return <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 text-sm text-[var(--color-subtext)]">グラフデータなし</div>;

  const chartType = widget.chartType || "line";

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4">{widget.label}</h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        {chartType === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey={yFields[0]} nameKey={xKey} cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : chartType === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {yFields.length > 1 && <Legend />}
            {yFields.map((f, i) => (
              <Area key={f} type="monotone" dataKey={f} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        ) : chartType === "bar_stacked" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {yFields.map((f, i) => (
              <Bar key={f} dataKey={f} stackId="a" fill={colors[i % colors.length]} radius={i === yFields.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        ) : chartType === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {yFields.length > 1 && <Legend />}
            {yFields.map((f, i) => (
              <Bar key={f} dataKey={f} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {yFields.length > 1 && <Legend />}
            {yFields.map((f, i) => (
              <Line key={f} type="monotone" dataKey={f} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// --- Card List ---
function CardList({ widget }: { widget: Widget }) {
  const [entries, setEntries] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!widget.collection) return;
    fetch(`/api/data/${widget.collection}?limit=20`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [widget.collection]);

  if (loading) return <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 text-sm text-[var(--color-subtext)]">読み込み中...</div>;

  const keys = Object.keys(entries[0] || {}).filter((k) => !k.startsWith("_"));
  const titleKey = keys[0] || "title";
  const descKey = keys[1] || "";

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">{widget.label}</h3>
      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 text-sm text-[var(--color-subtext)]">データなし</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map((entry, i) => {
            const linkUrl = entry.url || entry.link || (widget.linkField ? entry[widget.linkField] : "");
            const Wrapper = linkUrl ? "a" : "div";
            return (
              <Wrapper key={i} href={linkUrl ? String(linkUrl) : undefined} target={linkUrl ? "_blank" : undefined} rel={linkUrl ? "noopener noreferrer" : undefined}
                className={`bg-white rounded-xl border border-[var(--color-border)] p-4 hover:shadow-sm transition-shadow ${linkUrl ? "cursor-pointer hover:border-[var(--color-primary)]" : ""}`}>
                <p className="font-medium text-sm text-[var(--color-text)]">{String(entry[titleKey] ?? "")}</p>
                {descKey && <p className="text-xs text-[var(--color-subtext)] mt-1">{String(entry[descKey] ?? "")}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {keys.slice(2, 5).filter(k => k !== "url" && k !== "link").map((k) => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded">
                      {k}: {String(entry[k] ?? "")}
                    </span>
                  ))}
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Progress Bar ---
function ProgressWidget({ widget }: { widget: Widget }) {
  const [value, setValue] = useState(0);
  const [max, setMax] = useState(100);
  useEffect(() => {
    if (!widget.collection) return;
    fetch(`/api/data/${widget.collection}?limit=1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.entries?.[0]) {
          const entry = d.entries[0];
          setValue(Number(entry[widget.valueField || widget.field || "value"] ?? 0));
          setMax(Number(entry[widget.maxField || "max"] ?? 100));
        }
      })
      .catch(() => {});
  }, [widget.collection, widget.field, widget.valueField, widget.maxField]);

  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{widget.label}</h3>
        <span className="text-sm font-bold text-[var(--color-primary)]">{pct}%</span>
      </div>
      <div className="h-3 bg-[var(--color-border-light)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-[var(--color-subtext)] mt-1.5">{value} / {max}</p>
    </div>
  );
}

// --- Iframe ---
function IframeWidget({ widget }: { widget: Widget }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{widget.label}</h3>
      </div>
      <iframe src={widget.url || ""} className="w-full border-0" style={{ minHeight: "400px" }} sandbox="allow-scripts allow-same-origin" />
    </div>
  );
}

// --- Links ---
function LinksWidget({ widget }: { widget: Widget }) {
  const [entries, setEntries] = useState<Record<string, string>[]>([]);
  useEffect(() => {
    if (widget.items) return; // static items
    if (!widget.collection) return;
    fetch(`/api/data/${widget.collection}?limit=20`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => {});
  }, [widget.collection, widget.items]);

  const links = widget.items || entries.map((e) => ({
    label: e.title || e.name || e.label || "",
    description: e.description || e.summary || "",
    url: e.url || e.link || "#",
  }));

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">{widget.label}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {links.map((item, i) => (
          <a key={i} href={item.url || "#"} target="_blank" rel="noopener noreferrer"
            className="bg-white rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm text-[var(--color-text)] group-hover:text-[var(--color-primary)]">{item.label}</p>
              <svg className="w-4 h-4 text-[var(--color-subtext)] group-hover:text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </div>
            {item.description && <p className="text-xs text-[var(--color-subtext)] mt-1">{item.description}</p>}
          </a>
        ))}
      </div>
    </div>
  );
}

// --- Actions ---
function ActionsWidget({ widget }: { widget: Widget }) {
  const [results, setResults] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const executeAction = async (i: number, item: { label: string; method?: string; endpoint?: string; body?: Record<string, unknown> }) => {
    if (!item.endpoint) return;
    setLoading((p) => ({ ...p, [i]: true }));
    try {
      const res = await fetch(item.endpoint.startsWith("/") ? item.endpoint : `/api/${item.endpoint}`, {
        method: item.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
      const data = await res.json();
      setResults((p) => ({ ...p, [i]: data.error ? `Error: ${data.error}` : "OK" }));
    } catch {
      setResults((p) => ({ ...p, [i]: "Error" }));
    }
    setLoading((p) => ({ ...p, [i]: false }));
    setTimeout(() => setResults((p) => { const n = { ...p }; delete n[i]; return n; }), 3000);
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">{widget.label}</h3>
      <div className="flex flex-wrap gap-2">
        {(widget.items || []).map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => executeAction(i, item)}
              disabled={loading[i]}
              className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {loading[i] && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {item.label}
            </button>
            {results[i] && <span className={`text-xs ${results[i]?.startsWith("Error") ? "text-red-500" : "text-green-600"}`}>{results[i]}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Page ---
export default function CustomPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useI18n();
  const [pageDef, setPageDef] = useState<PageDef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/data/dashboards?q=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        const found = (d.entries || []).find((e: PageDef) => e.slug === slug);
        if (found) setPageDef(found);
        else setError(locale === "ja" ? "ページが見つかりません" : "Page not found");
      })
      .catch(() => setError("Error"))
      .finally(() => setLoading(false));
  }, [slug, locale]);

  if (loading) return <div className="px-8 py-8"><div className="h-8 w-48 bg-[var(--color-border-light)] rounded animate-pulse mb-4" /><div className="h-24 bg-[var(--color-border-light)] rounded-xl animate-pulse" /></div>;
  if (error || !pageDef) return <div className="px-8 py-20 text-center text-[var(--color-subtext)]">{error}</div>;

  const widgets = pageDef.widgets || [];
  const metrics = widgets.filter((w) => w.type === "metric");
  const others = widgets.filter((w) => w.type !== "metric");

  return (
    <div className="px-8 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{pageDef.title}</h1>
        {pageDef.description && <p className="text-sm text-[var(--color-subtext)] mt-0.5">{pageDef.description}</p>}
      </div>
      {metrics.length > 0 && (
        <div className={`grid grid-cols-2 lg:grid-cols-${Math.min(metrics.length, 4)} gap-4 mb-6`}>
          {metrics.map((w, i) => <MetricCard key={i} widget={w} />)}
        </div>
      )}
      <div className="space-y-4">
        {others.map((w, i) => {
          switch (w.type) {
            case "table": return <DataTable key={i} widget={w} />;
            case "text": return <TextBlock key={i} widget={w} />;
            case "chart": return <ChartWidget key={i} widget={w} />;
            case "list": return <CardList key={i} widget={w} />;
            case "progress": return <ProgressWidget key={i} widget={w} />;
            case "iframe": return <IframeWidget key={i} widget={w} />;
            case "links": return <LinksWidget key={i} widget={w} />;
            case "actions": return <ActionsWidget key={i} widget={w} />;
            default: return null;
          }
        })}
      </div>
    </div>
  );
}
