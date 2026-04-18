import { Folder } from "lucide-react";
import { useSettingsStore, type Theme } from "../../stores/settingsStore";

function SegControl({ options, selected, onChange }: { options: string[]; selected: string; onChange?: (v: string) => void }) {
  return (
    <div className="seg-group" style={{ width: "fit-content" }}>
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange?.(opt)} className={`seg-item${opt === selected ? " active" : ""}`} style={{ minWidth: 80 }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "0.5px solid var(--border)", background: "var(--bg-input)",
  color: "var(--text-1)", fontSize: 13, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
};

export function GeneralPanel() {
  const theme = useSettingsStore(s => s.theme);
  const setTheme = useSettingsStore(s => s.setTheme);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Workspace Settings</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Configure this workspace</div>
      </div>

      <Field label="Workspace Name">
        <input style={inputStyle} placeholder="Geo" readOnly />
      </Field>

      <Field label="Working Directory">
        <div style={{ position: "relative" }}>
          <Folder size={13} color="var(--text-3)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input style={{ ...inputStyle, paddingLeft: 30 }} placeholder="~/workspaces/geo" readOnly />
        </div>
      </Field>

      <Field label="Default Model">
        <SegControl options={["claude-opus-4-6", "claude-sonnet-4-6"]} selected="claude-sonnet-4-6" />
      </Field>

      <Field label="Theme">
        <SegControl
          options={["Light", "Dark", "Auto"]}
          selected={theme.charAt(0).toUpperCase() + theme.slice(1)}
          onChange={(v) => setTheme(v.toLowerCase() as Theme)}
        />
      </Field>

      <div
        style={{
          marginTop: 8, padding: "12px 14px", borderRadius: 10,
          background: "var(--bg-hover)", border: "0.5px solid var(--border)",
          fontSize: 12, color: "var(--text-3)", lineHeight: 1.5,
        }}
      >
        Settings are stored in <code style={{ fontFamily: "monospace", color: "var(--text-2)" }}>~/.morph/workspaces/geo/config.toml</code>
      </div>
    </div>
  );
}
