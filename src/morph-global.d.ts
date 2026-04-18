// Global type for the window.Morph bridge injected by the HTML shell (compiler.ts)
declare global {
  interface Window {
    Morph?: {
      updateContext: (data: any) => void;
      register: (manifest: any) => void;
      readFile: (path: string) => Promise<string>;
      readBinaryFile: (path: string) => Promise<ArrayBuffer>;
      listDir: (path: string) => Promise<Array<{ name: string; path: string; isDir: boolean }>>;
      onCommand: (cb: (cmd: any) => void) => void;
      _commandHandlers: Map<string, Array<(cmd: any) => void>>;
      _currentAppName: string | null;
    };
    Globe?: any;
    marked?: { parse: (text: string) => string };
    DOMPurify?: { sanitize: (html: string) => string };
  }
}

export {};
