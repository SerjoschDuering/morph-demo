import { useState, useEffect } from "react";
import { useChatStore, type DirEntry } from "../stores/chatStore";

interface Props {
  rootPath: string;
  onListDir: (path: string) => void;
  onReadFile: (path: string) => void;
}

export function FileTree({ rootPath, onListDir, onReadFile }: Props) {
  const dirListings = useChatStore((s) => s.dirListings);

  useEffect(() => {
    if (rootPath && !dirListings[rootPath]) {
      onListDir(rootPath);
    }
  }, [rootPath, dirListings, onListDir]);

  const entries = dirListings[rootPath];
  if (!entries) {
    return (
      <div className="pl-2 py-1 text-[11px]" style={{ color: "var(--text-3)" }}>
        Loading...
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="pl-2 py-1 text-[11px]" style={{ color: "var(--text-3)" }}>
        Empty directory
      </div>
    );
  }

  return (
    <div className="space-y-px">
      {entries.map((entry) => (
        <TreeEntry key={entry.path} entry={entry} onListDir={onListDir} onReadFile={onReadFile} depth={0} />
      ))}
    </div>
  );
}

function TreeEntry({ entry, onListDir, onReadFile, depth }: {
  entry: DirEntry;
  onListDir: (path: string) => void;
  onReadFile: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const dirListings = useChatStore((s) => s.dirListings);

  const toggle = () => {
    if (entry.isDir) {
      const next = !expanded;
      setExpanded(next);
      if (next && !dirListings[entry.path]) {
        onListDir(entry.path);
      }
    } else {
      onReadFile(entry.path);
    }
  };

  const childEntries = entry.isDir ? dirListings[entry.path] : null;
  const icon = entry.isDir
    ? (expanded ? "▾" : "▸")
    : fileIcon(entry.name);

  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-[11px] hover:bg-[var(--bg-hover)] transition-colors"
        style={{ paddingLeft: `${8 + depth * 14}px`, color: entry.isDir ? "var(--text-2)" : "var(--text-3)" }}
      >
        <span className="w-3 text-center shrink-0 text-[10px]" style={{ color: "var(--text-3)" }}>
          {icon}
        </span>
        <span className={entry.isDir ? "font-medium" : "font-mono"}>{entry.name}</span>
      </button>
      {expanded && entry.isDir && (
        <div>
          {childEntries ? (
            childEntries.length > 0 ? (
              childEntries.map((child) => (
                <TreeEntry key={child.path} entry={child} onListDir={onListDir} onReadFile={onReadFile} depth={depth + 1} />
              ))
            ) : (
              <div className="text-[10px] py-0.5" style={{ paddingLeft: `${22 + depth * 14}px`, color: "var(--text-3)" }}>
                empty
              </div>
            )
          ) : (
            <div className="text-[10px] py-0.5" style={{ paddingLeft: `${22 + depth * 14}px`, color: "var(--text-3)" }}>
              ...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fileIcon(name: string): string {
  if (name.endsWith(".md")) return "📄";
  if (name.endsWith(".json")) return "{}";
  if (name.endsWith(".ts") || name.endsWith(".js") || name.endsWith(".mjs")) return "⟨⟩";
  if (name.endsWith(".sh")) return "$";
  return "·";
}
