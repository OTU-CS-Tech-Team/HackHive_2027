(() => {
  const lastScrollByTarget = new WeakMap();
  let lastTouchY = null;
  let lockedScrollY = 0;
  let scrollLocked = false;
  let originalBodyStyles;
  let originalRootOverflow;

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

  const syncPageScrollLock = () => {
    const menu = document.querySelector("[data-mobile-menu][open]");
    const shouldLock = Boolean(menu && getComputedStyle(menu).display !== "none");
    if (shouldLock === scrollLocked) return;

    const body = document.body;
    const root = document.documentElement;

    if (shouldLock) {
      lockedScrollY = getPageScrollY();
      originalBodyStyles = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
      };
      originalRootOverflow = root.style.overflow;
      body.style.position = "fixed";
      body.style.top = `-${lockedScrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      root.style.overflow = "hidden";
      scrollLocked = true;
      return;
    }

    body.style.position = originalBodyStyles.position;
    body.style.top = originalBodyStyles.top;
    body.style.left = originalBodyStyles.left;
    body.style.right = originalBodyStyles.right;
    body.style.width = originalBodyStyles.width;
    body.style.overflow = originalBodyStyles.overflow;
    root.style.overflow = originalRootOverflow;
    scrollLocked = false;
    window.scrollTo(0, lockedScrollY);
  };

  const onScroll = (event) => {
    if (document.querySelector("[data-mobile-menu][open]")) return;

    const target = getScrollTarget(event.target);
    const y = getScrollY(target);
    const previousY = lastScrollByTarget.get(target) ?? y;
    lastScrollByTarget.set(target, y);

    if (y <= 64) {
      setNavbarHidden(false);
    } 
    else if (Math.abs(y - previousY) > 8) {
      setNavbarHidden(y > previousY);
    }
  };

  const onMouseMove = (event) => {
    if (event.clientY <= 50) {
      setNavbarHidden(false);
    } else if (getPageScrollY() > 64 &&  y > previousY) {
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
    const drawer =
      target instanceof Element && target.closest("[data-mobile-page-navigation]");
    if (document.querySelector("[data-mobile-menu][open]")) {
      if (!drawer) {
        event.preventDefault();
      } else {
        const atTop = drawer.scrollTop <= 0;
        const atBottom =
          drawer.scrollTop + drawer.clientHeight >= drawer.scrollHeight - 1;
        if ((atTop && delta > 0) || (atBottom && delta < 0)) {
          event.preventDefault();
        }
      }
      lastTouchY = touchY;
      return;
    }

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
    if (details) {
      details.open = false;
      syncPageScrollLock();
    }
  };

  document.addEventListener("toggle", syncPageScrollLock, true);
  window.addEventListener("resize", syncPageScrollLock, { passive: true });
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
    { capture: true, passive: false },
  );
  document.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
  document.addEventListener("touchcancel", onTouchEnd, { capture: true, passive: true });
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-mobile-menu] > summary")) {
        window.setTimeout(syncPageScrollLock, 0);
      }
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
      syncPageScrollLock();
    }
  });

  lastScrollByTarget.set(document, getPageScrollY());
})();
