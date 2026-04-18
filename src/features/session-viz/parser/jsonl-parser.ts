import type {
  ContentBlock,
  EventType,
  ParsedSession,
  RawRecord,
  SessionEvent,
} from './types.ts';

/**
 * Map tool names from Claude Code JSONL to our EventType taxonomy.
 */
const TOOL_NAME_MAP: Record<string, EventType> = {
  Read: 'file_read',
  Write: 'file_write',
  Edit: 'file_edit',
  NotebookEdit: 'file_edit',
  Glob: 'file_glob',
  Grep: 'file_grep',
  WebFetch: 'web_fetch',
  WebSearch: 'web_search',
  Bash: 'bash',
  Agent: 'agent_spawn',
};

function toolNameToEventType(name: string): EventType {
  return TOOL_NAME_MAP[name] ?? 'tool_other';
}

/**
 * Extract the primary target string from a tool_use input block.
 * Returns undefined if no recognizable target field is found.
 */
function extractTarget(
  toolName: string,
  input: Record<string, unknown>,
): string | undefined {
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'NotebookEdit':
      return asString(input['file_path'] ?? input['filePath'] ?? input['notebook_path']);
    case 'Edit':
      return asString(input['file_path'] ?? input['filePath']);
    case 'Glob':
      return asString(input['pattern']);
    case 'Grep':
      return asString(input['path'] ?? input['pattern']);
    case 'WebFetch':
      return asString(input['url']);
    case 'WebSearch':
      return asString(input['query']);
    case 'Bash':
      return asString(input['command']);
    default:
      return undefined;
  }
}

/**
 * Build optional metadata from a tool_use input block.
 */
function extractMetadata(
  toolName: string,
  input: Record<string, unknown>,
): SessionEvent['metadata'] | undefined {
  const meta: SessionEvent['metadata'] = {};
  let hasContent = false;

  if (toolName === 'Bash') {
    const cmd = asString(input['command']);
    if (cmd) {
      meta.command = cmd;
      hasContent = true;
    }
  }
  if (toolName === 'WebSearch') {
    const q = asString(input['query']);
    if (q) {
      meta.searchQuery = q;
      hasContent = true;
    }
  }
  if (toolName === 'Glob') {
    const p = asString(input['pattern']);
    if (p) {
      meta.globPattern = p;
      hasContent = true;
    }
  }
  if (toolName === 'Grep') {
    const p = asString(input['pattern']);
    if (p) {
      meta.grepPattern = p;
      hasContent = true;
    }
  }
  if (toolName === 'Agent') {
    const desc = asString(input['description']);
    if (desc) {
      meta.agentDescription = desc;
      hasContent = true;
    }
  }

  return hasContent ? meta : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Parse JSONL text into an array of RawRecords.
 * Silently skips lines that are empty or not valid JSON.
 */
export function parseJsonlLines(text: string): RawRecord[] {
  if (!text || !text.trim()) return [];

  const records: RawRecord[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as RawRecord;
      // Only keep records that have at minimum a type field
      if (parsed && typeof parsed.type === 'string') {
        records.push(parsed);
      }
    } catch {
      // skip malformed lines
    }
  }

  return records;
}

/**
 * Extract SessionEvents from a list of RawRecords.
 * agentLabel is used to tag all events from this stream.
 */
function extractEvents(
  records: RawRecord[],
  agentLabel: string,
): {
  events: SessionEvent[];
  tokens: { input: number; output: number };
  sessionId: string;
  slug: string;
  minTs: number;
  maxTs: number;
} {
  const events: SessionEvent[] = [];
  const tokens = { input: 0, output: 0 };
  let sessionId = '';
  let slug = '';
  let minTs = Infinity;
  let maxTs = -Infinity;

  for (const rec of records) {
    if (!rec.timestamp) continue;

    const ts = new Date(rec.timestamp).getTime();
    if (isNaN(ts)) continue;

    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;

    if (!sessionId && rec.sessionId) sessionId = rec.sessionId;
    if (!slug && rec.slug) slug = rec.slug;

    // --- assistant records: tool_use, thinking, text ---
    if (rec.type === 'assistant' && rec.message) {
      const msg = rec.message;

      // accumulate tokens
      if (msg.usage) {
        tokens.input += msg.usage.input_tokens ?? 0;
        tokens.output += msg.usage.output_tokens ?? 0;
      }

      const content = msg.content;
      if (!Array.isArray(content)) continue;

      for (const block of content as ContentBlock[]) {
        if (block.type === 'tool_use') {
          const eventType = toolNameToEventType(block.name);
          const target = extractTarget(block.name, block.input);
          const metadata = extractMetadata(block.name, block.input);

          events.push({
            timestamp: ts,
            agent: agentLabel,
            type: eventType,
            toolUseId: block.id,
            target,
            metadata,
          });
        } else if (block.type === 'thinking') {
          events.push({
            timestamp: ts,
            agent: agentLabel,
            type: 'thinking',
            metadata: { content: block.thinking },
          });
        } else if (block.type === 'text') {
          events.push({
            timestamp: ts,
            agent: agentLabel,
            type: 'text_output',
            metadata: { content: block.text },
          });
        }
      }
    }

    // --- user records with toolUseResult ---
    if (rec.type === 'user' && rec.toolUseResult) {
      const tr = rec.toolUseResult;
      // Agent launch result — contains agentId → description mapping
      if (asString(tr['agentId']) && asString(tr['description'])) {
        events.push({
          timestamp: ts,
          agent: agentLabel,
          type: 'agent_spawn',
          metadata: {
            agentId: asString(tr['agentId']),
            agentDescription: asString(tr['description']),
          },
        });
      }
      // Agent completion result
      if (typeof tr['totalDurationMs'] === 'number') {
        events.push({
          timestamp: ts,
          agent: agentLabel,
          type: 'agent_complete',
          metadata: {
            durationMs: tr['totalDurationMs'] as number,
            agentId: asString(tr['agentId']),
          },
        });
      }
    }
  }

  return { events, tokens, sessionId, slug, minTs, maxTs };
}

/**
 * Parse a main JSONL string (and optional subagent JSONLs) into a
 * fully normalized ParsedSession.
 *
 * @param mainJsonl - The primary session JSONL text
 * @param subagentJsonls - Map of subagent slug -> JSONL text
 */
export function parseSession(
  mainJsonl: string,
  subagentJsonls?: Record<string, string>,
): ParsedSession {
  const mainRecords = parseJsonlLines(mainJsonl);
  const mainResult = extractEvents(mainRecords, 'main');

  let allEvents = [...mainResult.events];
  let totalInput = mainResult.tokens.input;
  let totalOutput = mainResult.tokens.output;
  let globalMin = mainResult.minTs;
  let globalMax = mainResult.maxTs;
  const agentSet = new Set<string>(['main']);

  // Process subagent JSONL files
  if (subagentJsonls) {
    for (const [slugKey, jsonlText] of Object.entries(subagentJsonls)) {
      const subRecords = parseJsonlLines(jsonlText);
      const subResult = extractEvents(subRecords, slugKey);

      allEvents = allEvents.concat(subResult.events);
      totalInput += subResult.tokens.input;
      totalOutput += subResult.tokens.output;

      if (subResult.minTs < globalMin) globalMin = subResult.minTs;
      if (subResult.maxTs > globalMax) globalMax = subResult.maxTs;

      agentSet.add(slugKey);
    }
  }

  // Sort all events by timestamp (stable sort)
  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  return {
    sessionId: mainResult.sessionId,
    slug: mainResult.slug || 'main',
    startTime: globalMin === Infinity ? 0 : globalMin,
    endTime: globalMax === -Infinity ? 0 : globalMax,
    events: allEvents,
    totalTokens: { input: totalInput, output: totalOutput },
    agents: Array.from(agentSet),
  };
}
