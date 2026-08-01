import { describe, expect, it, vi } from "vitest";

import { createObsidianFetch } from "../../src/obsidian/request-url-fetch";

describe("createObsidianFetch", () => {
  it("translates a fetch request to requestUrl without CORS enforcement", async () => {
    const requestUrl = vi.fn().mockResolvedValue({
      status: 201,
      headers: { "content-type": "application/json", "x-request-id": "safe-id" },
      arrayBuffer: new TextEncoder().encode('{"ok":true}').buffer,
      json: { ok: true },
      text: '{"ok":true}',
    });
    const fetch = createObsidianFetch(requestUrl);
    const requestBody = new TextEncoder().encode("request body").buffer;

    const response = await fetch(new URL("https://example.test/profile"), {
      method: "POST",
      headers: { "Auth-Token": "credential", "X-Client": "book-highlights" },
      body: "request body",
    });

    expect(requestUrl).toHaveBeenCalledWith({
      url: "https://example.test/profile",
      method: "POST",
      headers: {
        "auth-token": "credential",
        "content-type": "text/plain;charset=UTF-8",
        "x-client": "book-highlights",
      },
      body: requestBody,
      throw: false,
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("safe-id");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("preserves an ArrayBuffer request body", async () => {
    const requestUrl = vi.fn().mockResolvedValue({
      status: 204,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      json: undefined,
      text: "",
    });
    const fetch = createObsidianFetch(requestUrl);
    const body = new Uint8Array([1, 2, 3]).buffer;

    await fetch("https://example.test/resource", { method: "PUT", body });

    expect(requestUrl).toHaveBeenCalledWith({
      url: "https://example.test/resource",
      method: "PUT",
      headers: {},
      body,
      throw: false,
    });
  });

  it("preserves a Request input's method, headers, and body", async () => {
    const requestUrl = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      json: undefined,
      text: "",
    });
    const fetch = createObsidianFetch(requestUrl);
    const request = new Request("https://example.test/request", {
      body: "request body",
      headers: { "X-Request": "preserved" },
      method: "POST",
    });

    await fetch(request);

    expect(requestUrl).toHaveBeenCalledWith({
      url: "https://example.test/request",
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8", "x-request": "preserved" },
      body: new TextEncoder().encode("request body").buffer,
      throw: false,
    });
  });

  it("rejects an already-aborted request before network access", async () => {
    const requestUrl = vi.fn();
    const fetch = createObsidianFetch(requestUrl);
    const controller = new AbortController();
    controller.abort();

    await expect(fetch("https://example.test/resource", { signal: controller.signal })).rejects.toThrow();
    expect(requestUrl).not.toHaveBeenCalled();
  });
});
