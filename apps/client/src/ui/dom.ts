type Attrs = Record<string, unknown>;

export function h(tag: string, attrs: Attrs = {}, children: (Node | string | null | undefined)[] = []): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = String(value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function qs<T extends HTMLElement = HTMLElement>(selector: string): T {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`не найден ${selector}`);
  return node as T;
}

export function button(label: string, onClick: () => void, cls = 'ghost'): HTMLButtonElement {
  return h('button', { class: cls, onclick: onClick, text: label }) as HTMLButtonElement;
}
