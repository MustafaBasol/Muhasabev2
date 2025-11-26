declare global {
  interface WindowEventMap {
    'quotes-cache-updated': CustomEvent<void>;
  }
}

export {};
