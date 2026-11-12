import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../public/navbar-interactions.js', import.meta.url), 'utf8');

function browser(initialY = 0) {
  type Event = { target?: unknown; clientY?: number; touches?: { clientY: number }[] };
  const handlers: Record<string, (event: Event) => void> = {};
  class Element {
    inNavbar = false;
    scrollTop = 0;
    closest(selector: string) { return selector === '[data-navbar-shell]' && this.inNavbar ? navbar : null; }
  }
  const navbar = {
    dataset: { hidden: 'false' },
    contains: (element: Element | null) => Boolean(element?.inNavbar),
  };
  const document = {
    activeElement: null as Element | null,
    documentElement: { scrollTop: 0 },
    body: { scrollTop: 0 },
    querySelector: (selector: string) => selector === '[data-navbar-shell]' ? navbar : null,
    addEventListener: (name: string, handler: (event: Event) => void) => { handlers[name] = handler; },
  };
  const window = { scrollY: initialY, addEventListener: () => {} };
  const location = { href: 'http://site/' };
  vm.runInNewContext(script, { window, document, location, Element, HTMLElement: Element });
  return {
    navbar,
    scroll(y: number) {
      window.scrollY = y;
      // Browsers deliver the document scroll through both registered listeners.
      handlers.scroll({ target: document });
      handlers.scroll({ target: document });
    },
    move(clientY: number) { handlers.mousemove({ clientY }); },
    // A client-side page change: the URL updates, then the page scrolls once
    // (to the top, to a #section, or Back restoring where they were).
    navigate(href: string, y: number) {
      location.href = href;
      window.scrollY = y;
      handlers.scroll({ target: document });
      handlers.scroll({ target: document });
    },
    focusNavbar() {
      document.activeElement = new Element();
      document.activeElement.inNavbar = true;
      handlers.focusin({ target: document.activeElement });
    },
    swipe(from: number, to: number) {
      const target = new Element();
      handlers.touchstart({ target, touches: [{ clientY: from }] });
      handlers.touchmove({ target, touches: [{ clientY: to }] });
    },
  };
}

describe('navbar interaction regressions', () => {
  it('reveals at the top edge and hides on mouse leave after downward scrolling without throwing', () => {
    const page = browser();
    page.scroll(500);
    expect(() => page.move(100)).not.toThrow();
    expect(page.navbar.dataset.hidden).toBe('true');
    page.move(20);
    expect(page.navbar.dataset.hidden).toBe('false');
    page.move(100);
    expect(page.navbar.dataset.hidden).toBe('true');
  });

  it('accumulates small scroll steps, and stays hidden scrolling up until the top', () => {
    const page = browser(500);
    for (let y = 504; y <= 520; y += 4) page.scroll(y);
    expect(page.navbar.dataset.hidden).toBe('true');
    for (let y = 500; y > 64; y -= 100) page.scroll(y);
    expect(page.navbar.dataset.hidden).toBe('true');
    page.scroll(40);
    expect(page.navbar.dataset.hidden).toBe('false');
  });

  it('reveals keyboard focus and keeps focused controls visible during scrolling', () => {
    const page = browser();
    page.scroll(500);
    expect(page.navbar.dataset.hidden).toBe('true');
    page.focusNavbar();
    expect(page.navbar.dataset.hidden).toBe('false');
    page.scroll(600);
    page.move(100);
    expect(page.navbar.dataset.hidden).toBe('false');
  });

  it('shows the bar when going Back restores a spot further down the page', () => {
    const page = browser();
    page.scroll(5000);
    page.scroll(4400);
    page.navigate('http://site/judges', 0);
    page.navigate('http://site/', 4400);
    expect(page.navbar.dataset.hidden).toBe('false');
    page.move(100);
    expect(page.navbar.dataset.hidden).toBe('false');
    // Scrolling down from there still tucks it away.
    page.scroll(4500);
    expect(page.navbar.dataset.hidden).toBe('true');
  });

  it('shows the bar after a link jumps down to a section', () => {
    const page = browser();
    page.scroll(3000);
    expect(page.navbar.dataset.hidden).toBe('true');
    page.navigate('http://site/#faq', 7240);
    expect(page.navbar.dataset.hidden).toBe('false');
  });

  it('does not hide on a swipe up at the top of a page', () => {
    const page = browser(0);
    page.swipe(300, 250);
    expect(page.navbar.dataset.hidden).toBe('false');
  });

  it('hides on a swipe that scrolls down, and a swipe back up alone does not bring it back', () => {
    const page = browser(500);
    page.swipe(300, 250);
    expect(page.navbar.dataset.hidden).toBe('true');
    page.swipe(250, 300);
    expect(page.navbar.dataset.hidden).toBe('true');
  });
});
