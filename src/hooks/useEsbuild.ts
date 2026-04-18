import { useEffect } from "react";
import { initCompiler, compileApp } from "../lib/compiler";
import { useWorkspaceStore } from "../stores/workspaceStore";

let compiling = false;

async function compileAllPending() {
  if (compiling) return;
  compiling = true;
  try {
    await initCompiler();
    const { workspaces } = useWorkspaceStore.getState();
    let count = 0;
    for (const ws of workspaces) {
      for (const app of ws.apps) {
        if (app.status === "compiling" && app.sourceCode) {
          count++;
          await compileAndStore(ws.id, app.id, app.sourceCode);
        }
      }
    }
    if (count) console.debug(`[esbuild] compiled ${count} apps`);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[esbuild] init failed:", msg);
    const { workspaces, updateApp } = useWorkspaceStore.getState();
    for (const ws of workspaces) {
      for (const app of ws.apps) {
        if (app.status === "compiling") {
          updateApp(ws.id, app.id, { status: "error", error: `Compiler init failed: ${msg}` });
        }
      }
    }
  } finally {
    compiling = false;
  }
}

// Initialize on mount, then subscribe so HMR store resets also trigger recompile.
export function useEsbuildInit(): void {
  useEffect(() => {
    compileAllPending();

    // Re-trigger whenever any app enters "compiling" state (covers HMR resets and new apps)
    const unsub = useWorkspaceStore.subscribe((state) => {
      const needsCompile = state.workspaces.some(ws =>
        ws.apps.some(a => a.status === "compiling" && a.sourceCode && !compiling)
      );
      if (needsCompile) compileAllPending();
    });

    return unsub;
  }, []);
}

// Compile a specific app tab. Called when app_created/app_updated event arrives.
export async function compileAndStore(
  workspaceId: string,
  appId: string,
  sourceCode: string
): Promise<void> {
  const store = useWorkspaceStore.getState();

  store.updateApp(workspaceId, appId, { status: "compiling", compiledJs: undefined, error: undefined });
  console.debug(`[esbuild] compiling ${appId}...`);

  try {
    const timeoutPromise = new Promise<{ js: string; error: string }>((resolve) =>
      setTimeout(() => resolve({ js: "", error: "Compilation timeout (15s) — esbuild WASM may not have loaded" }), 15000)
    );
    const { js, error } = await Promise.race([compileApp(sourceCode), timeoutPromise]);

    if (error) {
      console.debug(`[esbuild] ${appId} error:`, error);
      store.updateApp(workspaceId, appId, { status: "error", error });
    } else {
      console.debug(`[esbuild] ${appId} ready, js bytes:`, js.length);
      store.updateApp(workspaceId, appId, { status: "ready", compiledJs: js });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.debug(`[esbuild] ${appId} threw:`, error);
    store.updateApp(workspaceId, appId, { status: "error", error });
  }
}
