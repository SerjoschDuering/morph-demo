import type { PermissionRequest } from "../stores/chatStore";

interface Props {
  permission: PermissionRequest;
  queueSize: number;
  onRespond: (id: string, allow: boolean, updatedPermissions?: unknown[]) => void;
}

export function PermissionDialog({ permission, queueSize, onRespond }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Tool permission request" className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[var(--bg-active)] border border-[var(--border)] rounded-2xl p-5 max-w-[400px] w-[90%] shadow-[var(--shadow-modal)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="text-[14px] font-semibold">Allow this action?</div>
            <div className="text-[12px] text-[var(--text-3)]">
              Claude wants to use a tool
              {queueSize > 1 && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent-soft)] text-[var(--accent)]">
                  +{queueSize - 1} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-[var(--bg-panel)] rounded-xl p-3 mb-4">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-[11px] text-[var(--text-3)] uppercase">Tool</span>
            <span className="text-[13px] font-mono text-[var(--accent)] font-medium">{permission.tool}</span>
          </div>
          <pre className="text-[12px] text-[var(--text-2)] whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
            {permission.description}
          </pre>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onRespond(permission.id, false)}
            aria-label="Deny tool use"
            className="flex-1 py-2.5 rounded-xl text-[13px] font-medium border border-[var(--border)] text-[var(--text-2)] hover:text-[#ef4444] hover:border-[#ef4444]/30 hover:bg-[rgba(239,68,68,0.08)] transition-colors"
          >
            Deny
          </button>
          {permission.suggestions && permission.suggestions.length > 0 && (
            <button
              onClick={() => onRespond(permission.id, true, permission.suggestions!)}
              aria-label="Always allow this tool"
              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium border border-[var(--accent-border)] text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
              title="Allow and don't ask again for this tool this session"
            >
              Always
            </button>
          )}
          <button
            onClick={() => onRespond(permission.id, true)}
            aria-label="Allow tool use"
            className="flex-1 py-2.5 rounded-xl text-[13px] font-medium bg-[var(--accent)] text-[var(--bg-panel)] hover:brightness-110 transition-all"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
