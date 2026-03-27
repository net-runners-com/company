"use client";

import Avatar, { genConfig } from "react-nice-avatar";
import type { CSSProperties } from "react";

interface Props {
  seed: string;
  size?: string;
  style?: CSSProperties;
  className?: string;
}

export function EmployeeAvatar({ seed, size = "3.5rem", style, className }: Props) {
  const config = genConfig(seed);

  return (
    <Avatar
      className={className}
      style={{ width: size, height: size, ...style }}
      {...config}
    />
  );
}
