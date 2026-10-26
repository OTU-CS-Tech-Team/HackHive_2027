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
  vm.runInNewContext(script, { window, document, Element, HTMLElement: Element });
  return {
    navbar,
    scroll(y: number) {
      window.scrollY = y;
      // Browsers deliver the document scroll through both registered listeners.
      handlers.scroll({ target: document });
      handlers.scroll({ target: document });
    },
    move(clientY: number) { handlers.mousemove({ clientY }); },
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

  it('accumulates small scroll steps and responds promptly when direction reverses', () => {
    const page = browser(500);
    for (let y = 504; y <= 520; y += 4) page.scroll(y);
    expect(page.navbar.dataset.hidden).toBe('true');
    page.scroll(516);
    page.scroll(512);
    expect(page.navbar.dataset.hidden).toBe('false');
    page.move(100);
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

  it('preserves touch-direction behavior', () => {
    const page = browser(500);
    page.swipe(300, 250);
    expect(page.navbar.dataset.hidden).toBe('true');
    page.swipe(250, 300);
    expect(page.navbar.dataset.hidden).toBe('false');
  });
});
