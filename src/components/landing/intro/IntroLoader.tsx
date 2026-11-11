import { IntroOverlay } from "@/components/landing/intro/IntroOverlay";

/**
 * Runs during parsing, before the first paint, so the honeycomb is either
 * there from the very first frame or never shows. Later loads in the same
 * session get the light entrance ("lite": a soft fade and the copy rising
 * in). Reduced motion and deep links (a #hash, where the hero is not what
 * the visitor came to see) skip both. If storage throws, it skips. Without
 * JS there is no attribute and the CSS keeps the loader hidden.
 */
const DECIDE = `(function(){var p="skip";try{var r=window.matchMedia("(prefers-reduced-motion: reduce)").matches;p=(r||location.hash)?"skip":sessionStorage.getItem("hh-intro")?"lite":"loading"}catch(e){}document.documentElement.dataset.intro=p})();`;

export function IntroLoader() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: DECIDE }} />
      <IntroOverlay />
    </>
  );
}
