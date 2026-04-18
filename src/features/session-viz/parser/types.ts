// --- Raw JSONL record types (subset we care about) ---

export interface RawRecord {
  type:
    | 'user'
    | 'assistant'
    | 'progress'
    | 'system'
    | 'queue-operation'
    | 'file-history-snapshot';
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  isSidechain?: boolean;
  agentId?: string;
  slug?: string;
  message?: RawMessage;
  toolUseResult?: Record<string, unknown>;
  sourceToolUseID?: string;
}

export interface RawMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: { type: string; text: string }[];
    };

// --- Extracted event types ---

export type EventType =
  | 'file_read'
  | 'file_write'
  | 'file_edit'
  | 'file_glob'
  | 'file_grep'
  | 'web_fetch'
  | 'web_search'
  | 'bash'
  | 'tool_other'
  | 'agent_spawn'
  | 'agent_complete'
  | 'thinking'
  | 'text_output';

export interface SessionEvent {
  timestamp: number;
  agent: string;
  type: EventType;
  toolUseId?: string;
  target?: string;
  metadata?: {
    content?: string;
    command?: string;
    searchQuery?: string;
    globPattern?: string;
    grepPattern?: string;
    agentDescription?: string;
    agentId?: string;
    durationMs?: number;
    tokenUsage?: { input: number; output: number };
    filenames?: string[];
  };
}

// --- Graph node/edge types ---

export type NodeKind =
  | 'agent'
  | 'subagent'
  | 'file'
  | 'directory'
  | 'url'
  | 'bash';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  color: string;
  tokens: number;
  accessCount: number;
  lastActiveAt: number;
  spawnedAt: number;
  firstAppearAt: number; // event index where this node first appears
  agent?: string;
  directory?: string;
  depth?: number;       // path depth for subtle Z offset
  rawAgentId?: string;  // raw UUID for subagent event matching
  [key: string]: unknown; // allow d3/three.js dynamic properties
}

export interface GraphEdge {
  source: string;
  target: string;
  agent: string;
  direction: 'read' | 'write';
  lastActiveAt: number;
  firstAppearAt: number; // event index where this edge first appears
}

export interface ParsedSession {
  sessionId: string;
  slug: string;
  startTime: number;
  endTime: number;
  events: SessionEvent[];
  totalTokens: { input: number; output: number };
  agents: string[];
}
