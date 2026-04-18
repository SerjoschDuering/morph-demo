// Pure transform functions extracted from bridge.mjs for testability.
// These are verbatim copies with `export` added — do NOT diverge.

export function transformEvent(event) {
  const base = { type: event.type, subtype: event.subtype, sessionId: event.session_id };

  if (event.type === "assistant") {
    return { ...base, message: event.message, parentToolUseId: event.parent_tool_use_id };
  }
  if (event.type === "stream_event") {
    return { ...base, type: "stream", event: event.event };
  }
  if (event.type === "result") {
    return { ...base, result: event.result, costUsd: event.total_cost_usd,
      durationMs: event.duration_ms, isError: event.subtype !== "success",
      errors: event.errors, modelUsage: event.model_usage };
  }
  if (event.type === "rate_limit_event") {
    return { ...base, rateLimitInfo: event.rate_limit_info };
  }
  if (event.type === "system") {
    if (event.subtype === "init") {
      return { ...base, tools: event.tools, model: event.model, cwd: event.cwd,
        slashCommands: event.slash_commands, plugins: event.plugins,
        skills: event.skills, mcpServers: event.mcp_servers };
    }
    if (event.subtype === "task_started") {
      return { ...base, taskId: event.task_id, toolUseId: event.tool_use_id,
        description: event.description, taskType: event.task_type, prompt: event.prompt };
    }
    if (event.subtype === "task_progress") {
      return { ...base, taskId: event.task_id, toolUseId: event.tool_use_id,
        description: event.description, lastToolName: event.last_tool_name,
        summary: event.summary, usage: event.usage };
    }
    if (event.subtype === "task_notification") {
      return { ...base, taskId: event.task_id, toolUseId: event.tool_use_id,
        status: event.status, summary: event.summary, outputFile: event.output_file,
        usage: event.usage };
    }
    if (event.subtype === "compact_boundary") {
      return { ...base, compactMetadata: event.compact_metadata };
    }
    if (event.subtype === "status") {
      return { ...base, status: event.status };
    }
    return base;
  }
  if (event.type === "tool_progress") {
    return { ...base, toolUseId: event.tool_use_id, toolName: event.tool_name,
      elapsed: event.elapsed_time_seconds, taskId: event.task_id };
  }
  if (event.type === "tool_use_summary") {
    return { ...base, summary: event.summary,
      precedingToolUseIds: event.preceding_tool_use_ids };
  }
  if (event.type === "user") {
    return { ...base, message: event.message, toolUseResult: event.tool_use_result };
  }
  return base;
}

export function formatToolDesc(name, input) {
  if (name === "Bash") return input.command || "Run command";
  if (name === "Read") return `Read ${input.file_path || "file"}`;
  if (name === "Write") return `Write ${input.file_path || "file"}`;
  if (name === "Edit") return `Edit ${input.file_path || "file"}`;
  if (name === "Agent") return input.description || input.prompt?.slice(0, 80) || "Run agent";
  return `${name}: ${JSON.stringify(input).slice(0, 120)}`;
}
