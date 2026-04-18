const AUTOMATIONS = [
  { name: "Daily memory consolidation", trigger: "Cron", schedule: "3:00 AM", status: "active" },
  { name: "Overture data refresh", trigger: "Cron", schedule: "Sundays", status: "paused" },
  { name: "Webhook: new project", trigger: "Webhook", schedule: "On trigger", status: "active" },
];

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 9px", borderRadius: 12,
        background: isActive ? "rgba(52,199,89,0.12)" : "rgba(255,159,10,0.12)",
        fontSize: 11, fontWeight: 600,
        color: isActive ? "var(--green)" : "var(--amber)",
      }}
    >
      <span
        style={{
          width: 5, height: 5, borderRadius: "50%",
          background: isActive ? "var(--green)" : "var(--amber)",
        }}
      />
      {isActive ? "Active" : "Paused"}
    </span>
  );
}

export function AutomationsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Automations</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Scheduled tasks and webhook triggers</div>
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
          + Add Automation
        </button>
      </div>

      <div style={{ border: "0.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
            padding: "8px 14px", background: "var(--bg-hover)",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          {["Name", "Trigger", "Schedule", "Status"].map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {h}
            </div>
          ))}
        </div>

        {AUTOMATIONS.map((a, i) => (
          <div
            key={a.name}
            style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
              padding: "11px 14px", alignItems: "center",
              borderBottom: i < AUTOMATIONS.length - 1 ? "0.5px solid var(--border)" : "none",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{a.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>{a.trigger}</div>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>{a.schedule}</div>
            <StatusBadge status={a.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
