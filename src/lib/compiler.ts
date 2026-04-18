import * as esbuild from "esbuild-wasm/esm/browser";

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initCompiler(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  console.debug("[compiler] starting esbuild WASM init (worker: false)...");
  initPromise = Promise.race([
    esbuild.initialize({ wasmURL: "/esbuild.wasm", worker: false }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("esbuild WASM init timeout after 30s")),
        30_000,
      ),
    ),
  ]).then(() => {
    initialized = true;
    console.debug("[compiler] esbuild WASM ready");
  }).catch((err) => {
    initPromise = null;
    console.debug("[compiler] esbuild init failed:", err);
    throw err;
  });
  return initPromise;
}

export async function compileApp(sourceCode: string): Promise<{ js: string; error?: string }> {
  await initCompiler();

  // Auto-fix legacy patterns that break esbuild IIFE output:
  // 1. `function MorphApp()` without export default → add export
  // 2. `var X = X;` trailing lines → remove (confuses IIFE variable capture)
  let src = sourceCode;
  src = src.replace(/\bvar\s+\w+\s*=\s*\w+\s*;?\s*$/gm, (match) => {
    const m = match.match(/\bvar\s+(\w+)\s*=\s*(\w+)/);
    return m && m[1] === m[2] ? "" : match;
  });
  if (!/\bexport\s+default\b/.test(src) && /\bfunction\s+MorphApp\b/.test(src)) {
    src += "\nexport default MorphApp;\n";
  }

  try {
    console.debug("[compiler] esbuild.build() starting", { len: src.length });
    const result = await esbuild.build({
      stdin: { contents: src, loader: "tsx", resolveDir: "/" },
      bundle: true,
      external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
      format: "iife",
      globalName: "MorphApp",
      jsx: "transform",
      jsxFactory: "React.createElement",
      jsxFragment: "React.Fragment",
      target: "es2020",
      define: { "process.env.NODE_ENV": '"production"' },
      write: false,
      outfile: "out.js",
    });

    console.debug("[compiler] esbuild.build() done, outputFiles:", result.outputFiles?.length ?? 0);
    if (!result.outputFiles?.length) {
      return { js: "", error: "esbuild produced no output files" };
    }
    const js = new TextDecoder().decode(result.outputFiles[0].contents);
    return { js };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.debug("[compiler] esbuild.build() threw:", error);
    return { js: "", error };
  }
}
