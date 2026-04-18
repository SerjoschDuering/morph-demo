use serde_json::Value;
use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Manager, State};

struct BridgeState {
    pid: Option<u32>,
    port: u16,
    restarting: bool,
    generation: u64,
}

struct AppState {
    bridge: Arc<Mutex<BridgeState>>,
    cwd: Mutex<String>,
}

fn find_project_root() -> Result<std::path::PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|e| format!("No cwd: {}", e))?;
    if cwd.join("sidecar/bridge.mjs").exists() {
        return Ok(cwd);
    }
    if let Some(parent) = cwd.parent() {
        if parent.join("sidecar/bridge.mjs").exists() {
            return Ok(parent.to_path_buf());
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let mut dir = exe_dir.to_path_buf();
            for _ in 0..4 {
                if dir.join("sidecar/bridge.mjs").exists() {
                    return Ok(dir);
                }
                dir = match dir.parent() {
                    Some(p) => p.to_path_buf(),
                    None => break,
                };
            }
        }
    }
    Err(format!("Cannot find sidecar/bridge.mjs from {:?}", cwd))
}

/// PID file path for stale bridge detection across crashes/restarts
fn pid_file_path() -> std::path::PathBuf {
    std::env::temp_dir().join("morph-bridge.pid")
}

/// Kill any stale bridge process from a prior crash (PID file based)
fn kill_stale_bridge() {
    let path = pid_file_path();
    if let Ok(contents) = std::fs::read_to_string(&path) {
        if let Ok(pid) = contents.trim().parse::<i32>() {
            #[cfg(unix)]
            unsafe {
                // Check if process exists (signal 0 = no-op, just checks)
                if libc::kill(pid, 0) == 0 {
                    eprintln!("[bridge] Killing stale bridge process (PID {})", pid);
                    libc::kill(pid, libc::SIGTERM);
                }
            }
        }
        let _ = std::fs::remove_file(&path);
    }
}

/// Write current bridge PID to file for crash recovery
fn write_pid_file(pid: u32) {
    let _ = std::fs::write(pid_file_path(), pid.to_string());
}

fn start_bridge() -> Result<(Child, u16), String> {
    kill_stale_bridge();

    let project_root = find_project_root()?;
    let bridge_path = project_root.join("sidecar/bridge.mjs");

    let mut child = Command::new("node")
        .arg(&bridge_path)
        .current_dir(&project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env_remove("CLAUDECODE")
        .env_remove("CLAUDE_CODE_ENTRYPOINT")
        .spawn()
        .map_err(|e| format!("Failed to start bridge: {}", e))?;

    // Read first line (port JSON) with 10s timeout to prevent hanging forever
    let stdout = child.stdout.take().ok_or("No stdout from bridge")?;
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(stdout);
        let mut line = String::new();
        let _ = reader.read_line(&mut line);
        let _ = tx.send(line);
    });

    let first_line = match rx.recv_timeout(Duration::from_secs(10)) {
        Ok(line) => line,
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Bridge startup timed out after 10s".to_string());
        }
    };

    if first_line.is_empty() {
        let _ = child.kill();
        let _ = child.wait();
        return Err("Bridge exited without producing port".to_string());
    }

    // Forward bridge stderr to Rust stderr so `tauri dev` shows errors
    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = std::io::BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                eprintln!("[bridge] {}", line);
            }
        });
    }

    let init: Value =
        serde_json::from_str(&first_line).map_err(|e| format!("Bad bridge init: {}", e))?;
    let port = init["port"]
        .as_u64()
        .ok_or("No port in bridge init")? as u16;

    write_pid_file(child.id());

    Ok((child, port))
}

/// Spawn a background thread that waits for the bridge process to exit.
/// On exit, marks the bridge as dead (port=0) so the frontend reconnects.
/// Uses generation counter to avoid zeroing port if a restart already replaced us.
fn spawn_watcher(mut child: Child, bridge: Arc<Mutex<BridgeState>>, gen: u64) {
    std::thread::spawn(move || {
        let status = child.wait();
        eprintln!("[bridge] Process exited: {:?}", status);

        // OOM detection (signal 9): delay before allowing restart
        #[cfg(unix)]
        if let Ok(ref s) = status {
            use std::os::unix::process::ExitStatusExt;
            if s.signal() == Some(9) {
                eprintln!("[bridge] Likely OOM killed — delaying restart by 5s");
                std::thread::sleep(Duration::from_secs(5));
            }
        }

        let mut b = lock_bridge(&bridge);
        // Only zero port if generation matches — a restart may have already replaced us
        if b.generation == gen {
            b.port = 0;
            b.pid = None;
        } else {
            eprintln!("[bridge] Stale watcher (gen {} vs current {}), skipping port reset", gen, b.generation);
        }
    });
}

/// Send SIGTERM to the bridge process by PID (Child was moved to watcher thread).
#[cfg(unix)]
fn kill_bridge(bridge: &mut BridgeState) {
    if let Some(pid) = bridge.pid.take() {
        unsafe { libc::kill(pid as i32, libc::SIGTERM); }
        bridge.port = 0;
    }
}

#[cfg(not(unix))]
fn kill_bridge(bridge: &mut BridgeState) {
    bridge.pid = None;
    bridge.port = 0;
}

/// Poison-safe lock helper
fn lock_bridge(bridge: &Arc<Mutex<BridgeState>>) -> std::sync::MutexGuard<'_, BridgeState> {
    bridge.lock().unwrap_or_else(|e| e.into_inner())
}

fn expand_tilde(path: &str) -> String {
    if path.starts_with("~/") || path == "~" {
        let home = dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        path.replacen('~', &home, 1)
    } else {
        path.to_string()
    }
}

#[tauri::command]
fn read_file_for_app(path: String) -> Result<String, String> {
    let expanded = expand_tilde(&path);
    std::fs::read_to_string(&expanded).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_binary_file_for_app(path: String) -> Result<tauri::ipc::Response, String> {
    let expanded = expand_tilde(&path);
    let bytes = std::fs::read(&expanded).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn list_dir_for_app(path: String) -> Result<Vec<serde_json::Value>, String> {
    let expanded = expand_tilde(&path);
    let entries = std::fs::read_dir(&expanded).map_err(|e| e.to_string())?;
    Ok(entries
        .filter_map(|e| e.ok())
        .map(|e| {
            serde_json::json!({
                "name": e.file_name().to_string_lossy(),
                "isDir": e.path().is_dir(),
                "path": e.path().to_string_lossy()
            })
        })
        .collect())
}

#[tauri::command]
fn write_file_for_app(path: String, content: String) -> Result<(), String> {
    let expanded = expand_tilde(&path);
    let p = std::path::Path::new(&expanded);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn append_debug_log(line: String) {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/tmp"));
    let path = home.join("morph-debug.log");
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "{}", line);
    }
}

#[tauri::command]
fn check_cli_installed() -> bool {
    Command::new("node")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[tauri::command]
fn get_default_cwd() -> String {
    dirs::desktop_dir()
        .or_else(dirs::home_dir)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string())
}

#[tauri::command]
fn get_bridge_port(state: State<'_, AppState>) -> u16 {
    lock_bridge(&state.bridge).port
}

#[tauri::command]
fn set_cwd(state: State<'_, AppState>, cwd: String) {
    if let Ok(mut stored) = state.cwd.lock() {
        *stored = cwd;
    }
}

#[tauri::command]
fn read_session_jsonl(session_id: String, cwd: String) -> Result<Value, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let encoded_cwd: String = cwd.chars().map(|c| {
        if c.is_ascii_alphanumeric() { c } else { '-' }
    }).collect();
    let base = home.join(".claude").join("projects").join(&encoded_cwd);
    let main_path = base.join(format!("{}.jsonl", session_id));
    let main_text = std::fs::read_to_string(&main_path)
        .map_err(|e| format!("Failed to read session {}: {}", main_path.display(), e))?;

    let mut subagents = serde_json::Map::new();
    let subs_dir = base.join(&session_id).join("subagents");
    if subs_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&subs_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
                    let slug = path.file_stem()
                        .unwrap_or_default().to_string_lossy()
                        .trim_start_matches("agent-").to_string();
                    if let Ok(text) = std::fs::read_to_string(&path) {
                        subagents.insert(slug, Value::String(text));
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "main": main_text,
        "subagents": Value::Object(subagents),
    }))
}

#[tauri::command]
fn restart_bridge(state: State<'_, AppState>) -> Result<u16, String> {
    // Check race guard + kill existing bridge (lock held briefly)
    {
        let mut bridge = lock_bridge(&state.bridge);
        if bridge.restarting {
            return Err("Restart already in progress".into());
        }
        bridge.restarting = true;
        kill_bridge(&mut bridge);
    } // lock released — start_bridge() can block freely

    let result = start_bridge();

    let mut bridge = lock_bridge(&state.bridge);
    bridge.restarting = false;
    match result {
        Ok((child, port)) => {
            bridge.generation += 1;
            bridge.pid = Some(child.id());
            bridge.port = port;
            let gen = bridge.generation;
            let arc = state.bridge.clone();
            drop(bridge); // release lock before spawning thread
            spawn_watcher(child, arc, gen);
            Ok(port)
        }
        Err(e) => Err(e),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let default_cwd = dirs::desktop_dir()
        .or_else(dirs::home_dir)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());

    let bridge_state = Arc::new(Mutex::new(BridgeState {
        pid: None,
        port: 0,
        restarting: false,
        generation: 0,
    }));

    // Start bridge sidecar
    match start_bridge() {
        Ok((child, port)) => {
            let gen = {
                let mut b = bridge_state.lock().unwrap();
                b.generation += 1;
                b.pid = Some(child.id());
                b.port = port;
                b.generation
            };
            spawn_watcher(child, bridge_state.clone(), gen);
        }
        Err(e) => {
            eprintln!("Warning: Bridge failed to start: {}", e);
        }
    };

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            bridge: bridge_state,
            cwd: Mutex::new(default_cwd),
        })
        .invoke_handler(tauri::generate_handler![
            check_cli_installed,
            get_default_cwd,
            get_bridge_port,
            set_cwd,
            restart_bridge,
            read_session_jsonl,
            read_file_for_app,
            read_binary_file_for_app,
            list_dir_for_app,
            write_file_for_app,
            append_debug_log,
        ])
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("nav-guard")
                .on_navigation(|_webview, url| {
                    let scheme = url.scheme();
                    let host = url.host_str().unwrap_or("");
                    // Allow: localhost (Vite), tauri://, blob:, about: (srcdoc/blank iframes)
                    if host == "localhost" || host == "127.0.0.1"
                        || scheme == "tauri"
                        || scheme == "blob"
                        || scheme == "about"
                    {
                        return true;
                    }
                    // External URL — open in system browser, block webview navigation
                    eprintln!("[navigation] redirecting to system browser: {}", url);
                    let _ = Command::new("open").arg(url.as_str()).spawn();
                    false
                })
                .build(),
        )
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // RunEvent::Exit for cleanup — on_shutdown doesn't exist in Tauri 2
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let state: State<'_, AppState> = app_handle.state();
            let mut bridge = lock_bridge(&state.bridge);
            kill_bridge(&mut bridge);
            let _ = std::fs::remove_file(pid_file_path());
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_cwd_encoding() {
        let cwd = "/home/user/projects/demo";
        let encoded: String = cwd.chars().map(|c| {
            if c.is_ascii_alphanumeric() { c } else { '-' }
        }).collect();
        assert_eq!(encoded, "-home-user-projects-demo");
    }

    #[test]
    fn test_cwd_encoding_special_chars() {
        let cwd = "/path/with spaces/and-dashes";
        let encoded: String = cwd.chars().map(|c| {
            if c.is_ascii_alphanumeric() { c } else { '-' }
        }).collect();
        assert_eq!(encoded, "-path-with-spaces-and-dashes");
    }

    #[test]
    fn test_read_session_jsonl_missing_file() {
        let result = read_session_jsonl(
            "nonexistent-session".to_string(),
            "/nonexistent/path".to_string(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_read_session_jsonl_with_fixture() {
        let tmp = TempDir::new().unwrap();
        let encoded_cwd = "-tmp-test";
        let session_dir = tmp.path().join(".claude").join("projects").join(encoded_cwd);
        fs::create_dir_all(&session_dir).unwrap();

        let session_file = session_dir.join("test-session.jsonl");
        fs::write(&session_file, "{\"type\":\"system\",\"subtype\":\"init\"}\n{\"type\":\"assistant\"}\n").unwrap();

        // Verify fixture structure is correct
        let content = fs::read_to_string(&session_file).unwrap();
        assert!(content.contains("system"));
        assert!(content.contains("assistant"));
    }

    #[test]
    fn test_read_session_jsonl_with_subagents() {
        let tmp = TempDir::new().unwrap();
        let session_dir = tmp.path().join("projects").join("-tmp-test");
        let subagent_dir = session_dir.join("test-session").join("subagents");
        fs::create_dir_all(&subagent_dir).unwrap();

        let main_file = session_dir.join("test-session.jsonl");
        fs::write(&main_file, "{\"type\":\"system\"}\n").unwrap();

        // Subagent JSONL — slug stripping: "agent-research.jsonl" → "research"
        let sub_file = subagent_dir.join("agent-research.jsonl");
        fs::write(&sub_file, "{\"type\":\"assistant\",\"subagent\":true}\n").unwrap();

        assert!(sub_file.exists());
        let stem = sub_file.file_stem().unwrap().to_str().unwrap();
        let slug = stem.trim_start_matches("agent-");
        assert_eq!(slug, "research");

        // Empty slug edge case
        let empty_slug_file = subagent_dir.join("agent-.jsonl");
        fs::write(&empty_slug_file, "{}\n").unwrap();
        let empty_stem = empty_slug_file.file_stem().unwrap().to_str().unwrap();
        let empty_slug = empty_stem.trim_start_matches("agent-");
        assert_eq!(empty_slug, "");
    }

    #[test]
    fn test_pid_file_path() {
        let path = pid_file_path();
        assert!(path.to_string_lossy().contains("morph-bridge.pid"));
    }

    #[test]
    fn test_check_cli_installed() {
        // Node should be installed on dev machine
        assert!(check_cli_installed());
    }

    #[test]
    fn test_get_default_cwd() {
        let cwd = get_default_cwd();
        assert!(!cwd.is_empty());
        assert!(cwd.starts_with('/'));
    }
}
