import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { headersMock } = vi.hoisted(() => ({ headersMock: vi.fn() }));
vi.mock("next/headers", () => ({ headers: headersMock }));

import { clientAddress } from "./request";

describe("clientAddress", () => {
  beforeEach(() => headersMock.mockReset());

  it("uses Vercel's platform-provided client address", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-vercel-forwarded-for": "203.0.113.8" }));
    await expect(clientAddress()).resolves.toBe("203.0.113.8");
  });

  it("supports Cloudflare's client address header", async () => {
    headersMock.mockResolvedValue(new Headers({ "cf-connecting-ip": "2001:db8::8" }));
    await expect(clientAddress()).resolves.toBe("2001:db8::8");
  });

  it("uses the proxy-appended final forwarded address, not the visitor-supplied first entry", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-forwarded-for": "198.51.100.99, 203.0.113.12" }));
    await expect(clientAddress()).resolves.toBe("203.0.113.12");
  });

  it("rejects invalid and missing addresses", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "not-an-ip" }));
    await expect(clientAddress()).resolves.toBe("unknown");
  });
});
