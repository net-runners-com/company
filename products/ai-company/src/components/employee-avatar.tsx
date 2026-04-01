"use client";

import Avatar, { genConfig, type AvatarFullConfig } from "react-nice-avatar";
import type { CSSProperties } from "react";

interface Props {
  seed: string;
  size?: string;
  style?: CSSProperties;
  className?: string;
  config?: Partial<AvatarFullConfig>;
}

export function EmployeeAvatar({ seed, size = "3.5rem", style, className, config: customConfig }: Props) {
  const baseConfig = genConfig(seed);
  const config = customConfig ? { ...baseConfig, ...customConfig } : baseConfig;

  return (
    <Avatar
      className={className}
      style={{ width: size, height: size, ...style }}
      {...config}
    />
  );
}
