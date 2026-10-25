// Minimal DOM double: just enough surface for src/view.js and src/app.js, with no dependencies.
class FakeNode {
  constructor(tag, id = '') {
    this.tag = tag;
    this.id = id;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.className = '';
    this.focused = false;
    this.clicked = 0;
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  focus() { this.focused = true; }
  click() { this.clicked += 1; this.listeners.get('click')?.(); }
}

/** Create a document-like object whose getElementById lazily creates nodes. */
export function createFakeDocument() {
  const nodes = new Map();
  return {
    nodes,
    createElement: (tag) => new FakeNode(tag),
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, new FakeNode('div', id));
      return nodes.get(id);
    },
    querySelector(selector) {
      if (selector !== '[aria-invalid="true"]') throw new Error(`unsupported selector ${selector}`);
      return [...nodes.values()].find((node) => node.getAttribute('aria-invalid') === 'true') ?? null;
    },
  };
}

/** In-memory Storage double. */
export function createFakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); }, store };
}
