/**
 * Inline in the root layout, at the top of <body>, so it runs during
 * parsing, before the first paint: the honeycomb is either there from the
 * very first frame or never shows. It lives in the layout rather than the
 * page because layouts are only rendered on the server; a page renders on
 * the client during a soft navigation, and React refuses (and logs) a
 * <script> it renders there.
 *
 * Only the homepage plays the intro. Later loads in the same session get the
 * light entrance ("lite": the copy rises and the scene fades in). Reduced
 * motion and deep links (a #hash, where the hero is not what the visitor came
 * to see) skip both. If storage throws, it skips. Without JS there is no
 * attribute and the CSS keeps the loader hidden.
 */
export const INTRO_DECIDE_SCRIPT = `(function(){if(location.pathname!=="/")return;var p="skip";try{var r=window.matchMedia("(prefers-reduced-motion: reduce)").matches;p=(r||location.hash)?"skip":sessionStorage.getItem("hh-intro")?"lite":"loading"}catch(e){}document.documentElement.dataset.intro=p})();`;
