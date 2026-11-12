"use client";

// Page-wide CSS that should only apply while its page is showing. With cacheComponents,
// Next keeps pages you leave mounted but hidden (<Activity>), so a rule like
// html:has([data-x]) in globals.css keeps matching the hidden page's DOM. This sheet
// is switched off while its page is hidden. See "Global styles" in
// node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md.
export function PageStyle({ css }: { css: string }) {
  return (
    <style
      ref={(style) => {
        if (!style) return;
        style.media = "";
        return () => {
          style.media = "not all";
        };
      }}
    >
      {css}
    </style>
  );
}

// The apply and admin pages have their own sidebar nav, so the site bar steps aside on desktop.
export function HideSiteNavbar() {
  return <PageStyle css="@media (min-width: 768px) { [data-navbar-shell] { display: none; } }" />;
}
