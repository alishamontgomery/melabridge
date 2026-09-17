/**
 * A top-level HTML navigation must never be converted into Clerk's session
 * handshake redirect. The browser Clerk client can refresh an expired session
 * in the background after the app shell has loaded.
 */
export function isBrowserDocumentRequest(
  request: Pick<Request, "method" | "headers">,
  handlerType?: string,
): boolean {
  if (handlerType === "serverFn") return false;
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return (request.headers.get("accept") ?? "").includes("text/html");
}