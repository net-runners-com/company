"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { mockEmployees } from "@/data/mock";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";

// Department config
const deptConfig: Record<string, { label: string; labelEn: string; color: string; bg: string }> = {
  ceo:              { label: "社長",       labelEn: "CEO",           color: "#6366f1", bg: "#eef2ff" },
  "general-affairs":{ label: "総務",       labelEn: "General Affairs", color: "#8b5cf6", bg: "#f5f3ff" },
  marketing:        { label: "マーケティング", labelEn: "Marketing",    color: "#ec4899", bg: "#fdf2f8" },
  research:         { label: "リサーチ",   labelEn: "Research",      color: "#06b6d4", bg: "#ecfeff" },
  sales:            { label: "営業",       labelEn: "Sales",         color: "#f59e0b", bg: "#fffbeb" },
  dev:              { label: "開発",       labelEn: "Development",   color: "#10b981", bg: "#ecfdf5" },
  accounting:       { label: "経理",       labelEn: "Accounting",    color: "#f97316", bg: "#fff7ed" },
  pm:               { label: "PM",         labelEn: "PM",            color: "#3b82f6", bg: "#eff6ff" },
  strategy:         { label: "戦略",       labelEn: "Strategy",      color: "#14b8a6", bg: "#f0fdfa" },
  hr:               { label: "人事",       labelEn: "HR",            color: "#a855f7", bg: "#faf5ff" },
  engineering:      { label: "エンジニアリング", labelEn: "Engineering", color: "#22c55e", bg: "#f0fdf4" },
  newbiz:           { label: "新規事業",   labelEn: "New Business",  color: "#ef4444", bg: "#fef2f2" },
  finance:          { label: "財務",       labelEn: "Finance",       color: "#64748b", bg: "#f8fafc" },
};

// Custom node for departments
function DeptNode({ data }: { data: { label: string; color: string; bg: string; employeeCount: number } }) {
  return (
    <div
      className="px-5 py-3 rounded-xl border-2 shadow-sm min-w-[140px] text-center"
      style={{ borderColor: data.color, backgroundColor: data.bg }}
    >
      <div className="text-sm font-bold" style={{ color: data.color }}>{data.label}</div>
      <div className="text-[10px] mt-0.5" style={{ color: data.color, opacity: 0.7 }}>
        {data.employeeCount} members
      </div>
    </div>
  );
}

// Custom node for employees
function EmployeeNode({ data }: { data: { employee: { id: string; name: string; role: string; status: string }; color: string } }) {
  const emp = data.employee;
  return (
    <Link href={`/employee/${emp.id}`}>
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow min-w-[150px] cursor-pointer"
        style={{ borderColor: data.color + "40" }}
      >
        <EmployeeAvatar seed={emp.id} size="2rem" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[var(--color-text)] truncate">{emp.name}</div>
          <div className="text-[10px] text-[var(--color-subtext)] truncate">{emp.role}</div>
        </div>
        <div
          className="w-2 h-2 rounded-full shrink-0 ml-auto"
          style={{ backgroundColor: emp.status === "active" ? "#22c55e" : "#d1d5db" }}
        />
      </div>
    </Link>
  );
}

const nodeTypes = {
  dept: DeptNode,
  employee: EmployeeNode,
};

export default function OrganizationPage() {
  const { locale } = useI18n();

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // CEO node (top)
    const ceoDept = deptConfig.ceo;
    nodes.push({
      id: "ceo",
      type: "dept",
      position: { x: 500, y: 0 },
      data: { label: locale === "ja" ? "社長 (You)" : "CEO (You)", color: ceoDept.color, bg: ceoDept.bg, employeeCount: 0 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    // Group employees by department
    const deptGroups: Record<string, typeof mockEmployees> = {};
    for (const emp of mockEmployees) {
      if (!deptGroups[emp.department]) deptGroups[emp.department] = [];
      deptGroups[emp.department].push(emp);
    }

    const deptKeys = Object.keys(deptGroups);
    const deptWidth = 220;
    const totalWidth = deptKeys.length * deptWidth;
    const startX = 500 - totalWidth / 2 + deptWidth / 2;

    deptKeys.forEach((dept, dIdx) => {
      const cfg = deptConfig[dept] ?? { label: dept, labelEn: dept, color: "#6b7280", bg: "#f9fafb" };
      const deptId = `dept-${dept}`;
      const x = startX + dIdx * deptWidth;

      // Department node
      nodes.push({
        id: deptId,
        type: "dept",
        position: { x, y: 120 },
        data: {
          label: locale === "ja" ? cfg.label : cfg.labelEn,
          color: cfg.color,
          bg: cfg.bg,
          employeeCount: deptGroups[dept].length,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      // Edge from CEO to department
      edges.push({
        id: `ceo-${deptId}`,
        source: "ceo",
        target: deptId,
        type: "smoothstep",
        style: { stroke: cfg.color, strokeWidth: 2, opacity: 0.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: cfg.color },
      });

      // Employee nodes under department
      deptGroups[dept].forEach((emp, eIdx) => {
        const empId = `emp-node-${emp.id}`;
        nodes.push({
          id: empId,
          type: "employee",
          position: { x: x - 5, y: 240 + eIdx * 65 },
          data: { employee: emp, color: cfg.color },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        });

        edges.push({
          id: `${deptId}-${empId}`,
          source: deptId,
          target: empId,
          type: "smoothstep",
          style: { stroke: cfg.color, strokeWidth: 1.5, opacity: 0.3 },
        });
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [locale]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edgesState, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-screen animate-fade-in">
      {/* Header */}
      <div className="bg-white border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {locale === "ja" ? "組織図" : "Organization Chart"}
        </h1>
        <p className="text-sm text-[var(--color-subtext)] mt-0.5">
          {locale === "ja"
            ? `${mockEmployees.length}名の社員 / ${Object.keys(deptConfig).length - 1}部署`
            : `${mockEmployees.length} employees / ${Object.keys(deptConfig).length - 1} departments`}
        </p>
      </div>

      {/* React Flow */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e5e7eb" gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeWidth={3}
            nodeColor={(n) => {
              if (n.type === "dept") return (n.data?.color as string) ?? "#6b7280";
              return "#fff";
            }}
            style={{ border: "1px solid var(--color-border)" }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
