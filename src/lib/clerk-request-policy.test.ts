import { describe, expect, it } from "vitest";
import { isBrowserDocumentRequest } from "./clerk-request-policy";

function request(method: string, accept: string) {
  return new Request("https://melabridge.com/", {
    method,
    headers: { accept },
  });
}

describe("Clerk request policy", () => {
  it("bypasses Clerk request middleware for top-level HTML navigations", () => {
    expect(isBrowserDocumentRequest(request("GET", "text/html,application/xhtml+xml"))).toBe(true);
    expect(isBrowserDocumentRequest(request("HEAD", "text/html"))).toBe(true);
  });

  it("keeps server functions and non-document requests on Clerk middleware", () => {
    expect(isBrowserDocumentRequest(request("GET", "text/html"), "serverFn")).toBe(false);
    expect(isBrowserDocumentRequest(request("POST", "text/html"))).toBe(false);
    expect(isBrowserDocumentRequest(request("GET", "application/json"))).toBe(false);
  });
});