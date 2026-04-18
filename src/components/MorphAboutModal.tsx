import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Bot, Layers, HardDrive, Zap } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function MorphAboutModal({ onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const features = [
    {
      icon: <Bot size={16} color="var(--accent)" />,
      title: "AI-generated apps",
      desc: "Ask Claude to build a React UI panel. It appears in your workspace instantly.",
    },
    {
      icon: <Layers size={16} color="var(--accent)" />,
      title: "Multi-surface",
      desc: "Same workspace from desktop, mobile web, or Telegram — shared state, single core.",
    },
    {
      icon: <Zap size={16} color="var(--accent)" />,
      title: "State feedback",
      desc: "Apps share context back to the AI. Chat orchestrates, apps inform.",
    },
    {
      icon: <HardDrive size={16} color="var(--accent)" />,
      title: "Filesystem-first",
      desc: "The workspace directory is the API. Files are truth, memory, and config.",
    },
  ];

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-overlay)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 340, borderRadius: 18, overflow: "hidden",
          background: "var(--bg-modal)", border: "1px solid var(--border)",
          boxShadow: "var(--shadow-modal)",
          animation: "modalIn 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "24px 24px 16px", textAlign: "center", borderBottom: "0.5px solid var(--border)" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: "0 auto 12px",
            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
            boxShadow: "0 4px 16px rgba(139,92,246,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={22} color="#fff" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>Morph</div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>A self-extending AI workspace</div>
        </div>

        {/* Feature grid */}
        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {features.map((f) => (
            <div key={f.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer badge */}
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{
            background: "var(--accent-soft)", borderRadius: 8, padding: "6px 12px",
            fontSize: 11, color: "var(--accent)", textAlign: "center", fontWeight: 500,
          }}>
            Demo preview · April 2026
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
