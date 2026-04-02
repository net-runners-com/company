"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Wave Streaming Text
 * ストリーミング中: 文字単位で waveIn アニメーション + カーソル点滅
 * 完了後: children で Markdown レンダリング
 */
export function StreamingText({
  content,
  isStreaming,
  children,
}: {
  content: string;
  isStreaming: boolean;
  children: (displayed: string) => React.ReactNode;
}) {
  const [displayedLen, setDisplayedLen] = useState(0);
  const targetLenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  // content が変わるたびにターゲットを更新
  targetLenRef.current = content.length;

  const tick = useCallback((timestamp: number) => {
    // 25msごとに1〜3文字ずつ追加（キューが溜まってたら速く）
    const elapsed = timestamp - lastTimeRef.current;
    if (elapsed >= 25) {
      lastTimeRef.current = timestamp;
      setDisplayedLen((prev) => {
        const remaining = targetLenRef.current - prev;
        if (remaining <= 0) return prev;
        const speed = Math.max(1, Math.min(3, Math.ceil(remaining / 12)));
        return Math.min(prev + speed, targetLenRef.current);
      });
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (isStreaming) {
      if (!rafRef.current) {
        lastTimeRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      }
    } else {
      // ストリーミング完了 → 全表示
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setDisplayedLen(content.length);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isStreaming, tick, content.length]);

  // ストリーミング完了 → Markdown レンダリング
  if (!isStreaming) {
    return <>{children(content)}</>;
  }

  // ストリーミング中 → 文字単位 wave アニメーション
  const displayed = content.slice(0, displayedLen);
  const chars = [...displayed];
  const animateFrom = Math.max(0, chars.length - 15);

  return (
    <div className="text-sm leading-relaxed">
      {chars.map((char, i) => {
        if (i >= animateFrom) {
          return (
            <span key={i} className="stream-char">
              {char === "\n" ? <br /> : char === " " ? "\u00A0" : char}
            </span>
          );
        }
        return char === "\n" ? <br key={i} /> : char;
      })}
      <span className="stream-cursor" />
    </div>
  );
}
