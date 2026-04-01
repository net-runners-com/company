"use client";

import { useState } from "react";
import Avatar, { genConfig, type AvatarFullConfig } from "react-nice-avatar";

const FACE_OPTIONS = ["base", "cute", "priness", "peace"];
const HAIR_OPTIONS = ["normal", "thick", "mohawk", "womanLong", "womanShort"];
const HAT_OPTIONS = ["none", "beanie", "turban"];
const EYE_OPTIONS = ["circle", "oval", "smile"];
const EAR_OPTIONS = ["small", "big"];
const NOSE_OPTIONS = ["short", "long", "round"];
const MOUTH_OPTIONS = ["laugh", "smile", "peace"];
const SHIRT_OPTIONS = ["hopizontalStripes", "short", "polo"];
const GLASS_OPTIONS = ["none", "round", "square"];
const BG_COLORS = ["#E0EDFF", "#FFE0E0", "#E0FFE0", "#FFF5E0", "#F0E0FF", "#E0FFF5", "#FFE0F5"];
const HAIR_COLORS = ["#000000", "#4A312C", "#D4A574", "#E8B86A", "#C63D2F", "#1E6091"];

interface Props {
  seed: string;
  onSelect: (config: Partial<AvatarFullConfig>) => void;
  initialConfig?: Partial<AvatarFullConfig>;
}

export function AvatarPicker({ seed, onSelect, initialConfig }: Props) {
  const base = genConfig(seed);
  const [config, setConfig] = useState<Partial<AvatarFullConfig>>({ ...base, ...initialConfig });

  const update = (key: string, value: string) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    onSelect(next);
  };

  const randomize = () => {
    const randomSeed = Math.random().toString(36).slice(2, 10);
    const newConfig = genConfig(randomSeed);
    setConfig(newConfig);
    onSelect(newConfig);
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex items-center gap-4">
        <Avatar style={{ width: "5rem", height: "5rem" }} {...(config as AvatarFullConfig)} />
        <button onClick={randomize}
          className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-light)] transition-colors">
          ランダム
        </button>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        <Selector label="顔" value={config.faceColor || ""} options={BG_COLORS}
          onSelect={(v) => update("faceColor", v)} type="color" />
        <Selector label="髪型" value={String(config.hairStyle || "")} options={HAIR_OPTIONS}
          onSelect={(v) => update("hairStyle", v)} type="text" />
        <Selector label="髪色" value={config.hairColor || ""} options={HAIR_COLORS}
          onSelect={(v) => update("hairColor", v)} type="color" />
        <Selector label="目" value={String(config.eyeStyle || "")} options={EYE_OPTIONS}
          onSelect={(v) => update("eyeStyle", v)} type="text" />
        <Selector label="帽子" value={String(config.hatStyle || "")} options={HAT_OPTIONS}
          onSelect={(v) => update("hatStyle", v)} type="text" />
        <Selector label="メガネ" value={String(config.glassesStyle || "")} options={GLASS_OPTIONS}
          onSelect={(v) => update("glassesStyle", v)} type="text" />
        <Selector label="口" value={String(config.mouthStyle || "")} options={MOUTH_OPTIONS}
          onSelect={(v) => update("mouthStyle", v)} type="text" />
        <Selector label="服" value={String(config.shirtStyle || "")} options={SHIRT_OPTIONS}
          onSelect={(v) => update("shirtStyle", v)} type="text" />
        <Selector label="背景" value={config.bgColor || ""} options={BG_COLORS}
          onSelect={(v) => update("bgColor", v)} type="color" />
      </div>
    </div>
  );
}

function Selector({ label, value, options, onSelect, type }: {
  label: string; value: string; options: string[]; onSelect: (v: string) => void; type: "color" | "text";
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-text)] mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          type === "color" ? (
            <button key={opt} onClick={() => onSelect(opt)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${value === opt ? "border-[var(--color-primary)] scale-110" : "border-transparent"}`}
              style={{ backgroundColor: opt }} />
          ) : (
            <button key={opt} onClick={() => onSelect(opt)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${value === opt ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-light)] text-[var(--color-subtext)]"}`}>
              {opt === "none" ? "なし" : opt}
            </button>
          )
        ))}
      </div>
    </div>
  );
}
