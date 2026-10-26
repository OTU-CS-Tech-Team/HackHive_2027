import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MobileNavMenu from "@/components/navbar/MobileNavMenu";
import { getAccountLinks, links } from "@/components/navbar/links";

describe("mobile navigation menu", () => {
  it("shows section links and Dashboard without My Application when signed in", () => {
    const markup = renderToStaticMarkup(
      createElement(MobileNavMenu, { links, accountLinks: getAccountLinks(true) }),
    );

    expect(markup).toContain('aria-label="Navigation menu"');
    expect(markup).toContain('href="/dashboard"');
    expect(markup).toContain("Dashboard");
    expect(markup).not.toContain("My Application");
    for (const link of links) expect(markup).toContain(`href="${link.href}"`);
  });

  it("shows section links without an account group when signed out", () => {
    const markup = renderToStaticMarkup(
      createElement(MobileNavMenu, { links, accountLinks: getAccountLinks(false) }),
    );

    expect(markup).not.toContain('aria-label="Account"');
    for (const link of links) expect(markup).toContain(`href="${link.href}"`);
  });
});