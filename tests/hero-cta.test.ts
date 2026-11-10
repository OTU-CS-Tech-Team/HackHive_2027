import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

import { HeroCta, HeroCtaFallback } from "@/components/landing/HeroCta";

describe("hero CTA", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it("sends signed-out visitors to signup", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const markup = renderToStaticMarkup(await HeroCta());

    expect(markup).toContain('href="/signup"');
    expect(markup).toContain("Sign up as a hacker");
    expect(markup).not.toContain("My Application");
    expect(markup).not.toContain('href="/apply"');
  });

  it("sends signed-in visitors to their application", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const markup = renderToStaticMarkup(await HeroCta());

    expect(markup).toContain('href="/apply"');
    expect(markup).toContain("My Application");
    expect(markup).not.toContain("Sign up as a hacker");
    expect(markup).not.toContain('href="/signup"');
  });

  it("falls back to the signed-out link while the session resolves", () => {
    const markup = renderToStaticMarkup(createElement(HeroCtaFallback));

    expect(markup).toContain('href="/signup"');
    expect(markup).toContain("Sign up as a hacker");
  });
});
