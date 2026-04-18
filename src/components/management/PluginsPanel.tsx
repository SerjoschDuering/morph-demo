import { useState } from "react";

interface ToggleProps {
  on: boolean;
}

function Toggle({ on }: ToggleProps) {
  return (
    <div
      style={{
        width: 32, height: 18, borderRadius: 9, flexShrink: 0,
        background: on ? "var(--accent)" : "var(--border)",
        position: "relative", transition: "background 0.15s",
      }}
    >
      <div
        style={{
          position: "absolute", top: 2, left: on ? 16 : 2,
          width: 14, height: 14, borderRadius: "50%",
          background: "#fff", transition: "left 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

const MCP_SERVERS = [
  { name: "Rhino/Grasshopper", status: "Connected", on: true },
  { name: "QGIS", status: "Available", on: false },
  { name: "PostGIS", status: "Available", on: false },
];

const SKILLS = [
  { name: "subagent-driven-development", on: true },
  { name: "systematic-debugging", on: true },
  { name: "writing-plans", on: true },
];

const PLUGINS = [
  { name: "morph-core", on: true },
  { name: "workspace-sync", on: true },
];

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
      {label}
    </div>
  );
}

function ItemRow({ name, badge, on }: { name: string; badge?: string; on: boolean }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 12px", borderRadius: 8, background: "var(--bg-card)",
        border: "0.5px solid var(--border)", marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{name}</span>
        {badge && (
          <span
            style={{
              fontSize: 10, fontWeight: 500, color: on ? "var(--green)" : "var(--text-3)",
              alignSelf: "flex-start",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <Toggle on={on} />
    </div>
  );
}

export function PluginsPanel() {
  // toggles are purely visual, state not hoisted
  const [_tick] = useState(0);
  void _tick;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <SectionHeader label="MCP Servers" />
        {MCP_SERVERS.map((m) => (
          <ItemRow key={m.name} name={m.name} badge={m.status} on={m.on} />
        ))}
      </div>

      <div>
        <SectionHeader label="Skills" />
        {SKILLS.map((s) => (
          <ItemRow key={s.name} name={s.name} on={s.on} />
        ))}
      </div>

      <div>
        <SectionHeader label="Plugins" />
        {PLUGINS.map((p) => (
          <ItemRow key={p.name} name={p.name} on={p.on} />
        ))}
      </div>
    </div>
  );
}
