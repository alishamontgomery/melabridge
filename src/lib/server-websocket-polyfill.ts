/**
 * Server-side WebSocket stub for Node.js < 22.
 *
 * Import this file early in any server-only module to prevent the
 * "@supabase/realtime-js: Node.js detected but native WebSocket not found"
 * runtime warning. The server never opens real-time Supabase connections;
 * this stub satisfies the internal type-check only and never connects.
 *
 * Safe to import unconditionally — the guard is a no-op on runtimes that
 * already expose a native WebSocket (browsers, Node ≥ 22, Cloudflare Workers).
 */
if (typeof globalThis.WebSocket === "undefined") {
  class _ServerWebSocket extends EventTarget {
    static CONNECTING = 0 as const;
    static OPEN = 1 as const;
    static CLOSING = 2 as const;
    static CLOSED = 3 as const;
    readonly readyState = 3 as const;
    readonly url: string;
    readonly protocol = "";
    readonly extensions = "";
    readonly bufferedAmount = 0;
    readonly binaryType: BinaryType = "blob";
    onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
    onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
    onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
    onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
    constructor(url: string | URL, _protocols?: string | string[]) {
      super();
      this.url = String(url);
    }
    close(_code?: number, _reason?: string) {}
    send(_data: string | ArrayBufferLike | Blob | ArrayBufferView) {}
  }
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = _ServerWebSocket;
}
