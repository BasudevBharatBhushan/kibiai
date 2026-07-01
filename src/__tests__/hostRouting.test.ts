import { describe, it, expect } from "vitest";
import { usesSubdomainRouting, usesPathRouting } from "@/lib/utils/hostRouting";

const BASE = "kibiai.itsb3.xyz";

describe("usesSubdomainRouting", () => {
  it("matches the apex base domain", () => {
    expect(usesSubdomainRouting("kibiai.itsb3.xyz", BASE)).toBe(true);
  });

  it("matches a tenant subdomain of the base domain", () => {
    expect(usesSubdomainRouting("acme.kibiai.itsb3.xyz", BASE)).toBe(true);
    expect(usesSubdomainRouting("admin.kibiai.itsb3.xyz", BASE)).toBe(true);
  });

  it("is case- and port-insensitive", () => {
    expect(usesSubdomainRouting("Acme.KiBiAI.itsb3.xyz:443", BASE)).toBe(true);
  });

  it("does NOT match Vercel preview hosts", () => {
    expect(usesSubdomainRouting("kibiai-git-test-sql-ki-flow.vercel.app", BASE)).toBe(false);
  });

  it("does NOT match localhost / LAN", () => {
    expect(usesSubdomainRouting("localhost:3000", BASE)).toBe(false);
    expect(usesSubdomainRouting("127.0.0.1", BASE)).toBe(false);
    expect(usesSubdomainRouting("192.168.1.10:3000", BASE)).toBe(false);
  });

  it("does NOT match a look-alike domain that merely contains the base", () => {
    // endsWith('.kibiai.itsb3.xyz') guards against `evilkibiai.itsb3.xyz`
    expect(usesSubdomainRouting("evilkibiai.itsb3.xyz", BASE)).toBe(false);
    expect(usesSubdomainRouting("kibiai.itsb3.xyz.evil.com", BASE)).toBe(false);
  });

  it("returns false when no base domain is configured", () => {
    expect(usesSubdomainRouting("anything.com", "")).toBe(false);
    expect(usesSubdomainRouting("anything.com", undefined)).toBe(false);
  });

  it("returns false for empty host", () => {
    expect(usesSubdomainRouting("", BASE)).toBe(false);
  });
});

describe("usesPathRouting", () => {
  it("is the inverse of usesSubdomainRouting", () => {
    const hosts = [
      "kibiai.itsb3.xyz",
      "acme.kibiai.itsb3.xyz",
      "kibiai-git-test-sql-ki-flow.vercel.app",
      "localhost:3000",
      "127.0.0.1",
      "",
    ];
    for (const h of hosts) {
      expect(usesPathRouting(h, BASE)).toBe(!usesSubdomainRouting(h, BASE));
    }
  });

  it("treats preview and localhost as path-based", () => {
    expect(usesPathRouting("kibiai-git-test-sql-ki-flow.vercel.app", BASE)).toBe(true);
    expect(usesPathRouting("localhost:3000", BASE)).toBe(true);
  });

  it("treats base-domain subdomains as NOT path-based", () => {
    expect(usesPathRouting("acme.kibiai.itsb3.xyz", BASE)).toBe(false);
  });
});
