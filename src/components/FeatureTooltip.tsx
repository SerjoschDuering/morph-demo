import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface FeatureTooltipProps {
  title: string;
  description: string;
  items?: Array<{ icon: string; text: string }>;
  children: React.ReactElement;
  side?: "right" | "bottom";
}

export function FeatureTooltip({ title, description, items, children, side = "right" }: FeatureTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const triggerRef = useRef<HTMLElement>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const TW = 240; // tooltip width
      if (side === "right") {
        const x = Math.min(rect.right + 8, window.innerWidth - TW - 8);
        setPos({ x, y: rect.top });
      } else {
        const x = Math.min(rect.left, window.innerWidth - TW - 8);
        setPos({ x, y: rect.bottom + 8 });
      }
      setVisible(true);
    }, 500);
  }, [side]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const trigger = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => { show(); children.props.onMouseEnter?.(e); },
    onMouseLeave: (e: React.MouseEvent) => { hide(); children.props.onMouseLeave?.(e); },
  });

  const card = visible ? (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: 240,
        zIndex: 9999,
        background: "var(--bg-modal)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "var(--shadow-modal)",
        padding: "14px 16px",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.6, marginBottom: items?.length ? 10 : 0 }}>
        {description}
      </div>
      {items && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11, color: "var(--text-2)" }}>
              <span>{item.icon}</span>
              <span style={{ lineHeight: 1.4 }}>{item.text}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{
        marginTop: 10, padding: "3px 8px", borderRadius: 6,
        background: "var(--accent-soft)", display: "inline-block",
        fontSize: 10, fontWeight: 500, color: "var(--accent)",
      }}>
        Demo feature
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {card && createPortal(card, document.body)}
    </>
  );
}
