/* Mermaid is large, so it is loaded only when a page actually contains a diagram. */
type MermaidApi = typeof import('mermaid')['default'];

let loading: Promise<MermaidApi> | null = null;
let seq = 0;

function load(): Promise<MermaidApi> {
  loading ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      themeVariables: { fontSize: '17px' },
      flowchart: { rankSpacing: 130, nodeSpacing: 60 },
    });
    return mermaid;
  });
  return loading;
}

/** renders a diagram to an SVG string; rejects on invalid syntax */
export async function renderMermaid(source: string): Promise<string> {
  const mermaid = await load();
  const { svg } = await mermaid.render(`mmd-${++seq}`, source);
  return svg;
}
