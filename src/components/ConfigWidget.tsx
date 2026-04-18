import { useState } from "react";

interface Props {
  appName: string;
  appId: string;
}

type Persistence = "ephemeral" | "local" | "cloud";
type DataScope = "workspace" | "shared";

export function ConfigWidget({ appName }: Props) {
  const [persistence, setPersistence] = useState<Persistence>("local");
  const [scope, setScope] = useState<DataScope>("workspace");

  return (
    <div style={{
      background: "var(--bg-panel)",
      border: "0.5px solid var(--border)",
      borderRadius: 12,
      padding: "14px 16px",
      maxWidth: 320,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    }}>
      {/* App name header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>📊</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{appName}</span>
      </div>

      {/* Persistence */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Persistence</div>
        <SegmentedControl
          options={[
            { value: "ephemeral", label: "Ephemeral" },
            { value: "local", label: "Local" },
            { value: "cloud", label: "Cloud" },
          ]}
          value={persistence}
          onChange={(v) => setPersistence(v as Persistence)}
        />
      </div>

      {/* Data scope */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Data scope</div>
        <SegmentedControl
          options={[
            { value: "workspace", label: "This workspace" },
            { value: "shared", label: "Shared" },
          ]}
          value={scope}
          onChange={(v) => setScope(v as DataScope)}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        {["Lock", "Duplicate", "Export", "Delete"].map((action) => (
          <button
            key={action}
            style={{
              flex: 1,
              fontSize: 11,
              padding: "4px 0",
              borderRadius: 6,
              border: "0.5px solid var(--border)",
              background: "var(--bg-hover)",
              color: "var(--text-2)",
              cursor: "pointer",
            }}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SegOption { value: string; label: string; }
function SegmentedControl({ options, value, onChange }: { options: SegOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{
      display: "flex",
      background: "var(--bg-hover)",
      borderRadius: 8,
      padding: 2,
      gap: 2,
    }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            fontSize: 11,
            padding: "4px 6px",
            borderRadius: 6,
            border: "none",
            background: value === opt.value ? "var(--bg-active)" : "transparent",
            color: value === opt.value ? "var(--accent)" : "var(--text-2)",
            fontWeight: value === opt.value ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
