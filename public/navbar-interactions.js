(() => {
  const lastScrollByTarget = new WeakMap();
  let lastTouchY = null;

  const getPageScrollY = () =>
    Math.max(
      window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        (document.scrollingElement && document.scrollingElement.scrollTop) ||
        0,
      0,
    );

  const getScrollTarget = (target) => {
    if (
      target instanceof HTMLElement &&
      target !== document.documentElement &&
      target !== document.body
    ) {
      return target;
    }

    return document;
  };

  const getScrollY = (target) =>
    target instanceof HTMLElement ? Math.max(target.scrollTop, 0) : getPageScrollY();

  const setNavbarHidden = (hidden) => {
    const navbar = document.querySelector("[data-navbar-shell]");
    if (navbar) navbar.dataset.hidden = String(hidden);
  };

  const onScroll = (event) => {
    const target = getScrollTarget(event.target);
    const y = getScrollY(target);
    const previousY = lastScrollByTarget.get(target) ?? y;
    lastScrollByTarget.set(target, y);

    if (y <= 64) {
      setNavbarHidden(false);
    } 
    else  {
      setNavbarHidden(true);
    }
  };

  const onMouseMove = (event) => {
    if (event.clientY <= 50) {
      setNavbarHidden(false);
    } 
    else if (getPageScrollY() > 64) {
      setNavbarHidden(true);
    }
  };

  const onTouchStart = (event) => {
    lastTouchY = event.touches.length === 1 ? event.touches[0].clientY : null;
  };

  const onTouchMove = (event) => {
    if (event.touches.length !== 1 || lastTouchY === null) return;

    const touchY = event.touches[0].clientY;
    const delta = touchY - lastTouchY;

    if (Math.abs(delta) <= 8) return;

    const target = event.target;
    if (!(target instanceof Element && target.closest("[data-mobile-page-navigation]"))) {
      setNavbarHidden(delta < 0);
    }
    lastTouchY = touchY;
  };

  const onTouchEnd = () => {
    lastTouchY = null;
  };

  const closeMenuFor = (target) => {
    if (!(target instanceof Element)) return;
    const details = target.closest("details");
    if (details) details.open = false;
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  document.addEventListener("mousemove", onMouseMove, { passive: true });
  document.addEventListener(
    "touchstart",
    onTouchStart,
    { capture: true, passive: true },
  );
  document.addEventListener(
    "touchmove",
    onTouchMove,
    { capture: true, passive: true },
  );
  document.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
  document.addEventListener("touchcancel", onTouchEnd, { capture: true, passive: true });
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-mobile-nav-close], [data-mobile-page-navigation] a")) {
        closeMenuFor(event.target);
      }
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelectorAll("details[open]").forEach((details) => {
        if (details.querySelector("[data-mobile-page-navigation]")) details.open = false;
      });
    }
  });

  lastScrollByTarget.set(document, getPageScrollY());
})();
