import { Plus } from "lucide-react";

interface Secret {
  name: string;
  service: string;
  status: "green" | "amber";
  masked: string;
  lastUsed: string;
}

const SECRETS: Secret[] = [
  { name: "OpenRouter API Key", service: "openrouter", status: "green", masked: "sk-or-****...****", lastUsed: "2 min ago" },
  { name: "GitHub Token", service: "github", status: "green", masked: "ghp_****...****", lastUsed: "1 hour ago" },
  { name: "Google Maps API", service: "google", status: "amber", masked: "AIza****...****", lastUsed: "3 days ago" },
  { name: "Anthropic API Key", service: "anthropic", status: "green", masked: "sk-ant-****...***", lastUsed: "Just now" },
];

const SERVICE_COLORS: Record<string, string> = {
  openrouter: "rgba(99,102,241,0.12)",
  github: "rgba(0,0,0,0.07)",
  google: "rgba(234,67,53,0.10)",
  anthropic: "rgba(139,92,246,0.12)",
};

const SERVICE_TEXT: Record<string, string> = {
  openrouter: "#6366f1",
  github: "var(--text-2)",
  google: "#ea4335",
  anthropic: "var(--accent)",
};

export function SecretsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>API Keys &amp; Secrets</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Stored securely in workspace keyring</div>
        </div>
        <button
          onClick={() => {}}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--border)",
            background: "var(--bg-hover)", color: "var(--text-1)", fontSize: 12,
            fontWeight: 500, cursor: "pointer",
          }}
        >
          <Plus size={13} />
          Add Secret
        </button>
      </div>

      {/* Table */}
      <div style={{ border: "0.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.2fr 80px 1.8fr 1fr",
            padding: "8px 14px",
            background: "var(--bg-hover)",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          {["Name", "Service", "Status", "Value", "Last Used"].map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {SECRETS.map((s, i) => (
          <div
            key={s.name}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 80px 1.8fr 1fr",
              padding: "10px 14px",
              alignItems: "center",
              borderBottom: i < SECRETS.length - 1 ? "0.5px solid var(--border)" : "none",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {/* Name */}
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{s.name}</div>

            {/* Service badge */}
            <div>
              <span
                style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                  background: SERVICE_COLORS[s.service] ?? "var(--bg-hover)",
                  color: SERVICE_TEXT[s.service] ?? "var(--text-2)",
                }}
              >
                {s.service}
              </span>
            </div>

            {/* Status dot */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                className={s.status === "green" ? "pulse-dot" : ""}
                style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: s.status === "green" ? "var(--green)" : "var(--amber)",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: s.status === "green" ? "var(--green)" : "var(--amber)" }}>
                {s.status === "green" ? "Active" : "Expiring"}
              </span>
            </div>

            {/* Masked value */}
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-3)" }}>{s.masked}</div>

            {/* Last used */}
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>{s.lastUsed}</div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div style={{ fontSize: 11, color: "var(--text-3)", paddingLeft: 2 }}>
        Secrets are encrypted at rest and never logged or transmitted in plaintext.
      </div>
    </div>
  );
}
