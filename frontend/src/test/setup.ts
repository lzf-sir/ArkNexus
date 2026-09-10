import "@testing-library/jest-dom";

// jsdom doesn't implement Element.animate — stub it for components that use Web Animations API
if (typeof Element !== "undefined" && !Element.prototype.animate) {
  Element.prototype.animate = () => ({
    cancel: () => {},
    finish: () => {},
    play: () => {},
    pause: () => {},
    reverse: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
    finished: Promise.resolve(),
    playState: "idle",
    currentTime: 0,
    startTime: 0,
  }) as unknown as Animation;
}

// jsdom doesn't implement matchMedia — stub for ThemeProvider
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
