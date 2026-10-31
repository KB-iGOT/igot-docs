/* Inline math in the documentation: $…$ and $$…$$ are typeset with KaTeX.
   Code spans and fences are tokenised before this runs, so a $ inside code stays as written. */
import { marked, type TokenizerAndRendererExtension } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** the specifications write "100%" meaning per cent (TeX would read % as a comment)
 *  and identifiers such as batch_cvo inside \text{}, where TeX does not allow a bare _ */
const prepare = (tex: string) =>
  tex.replace(/(?<!\\)%/g, '\\%').replace(/\\text\{([^{}]*)\}/g, (_, t: string) => `\\text{${t.replace(/(?<!\\)_/g, '\\_')}}`);

const typeset = (tex: string, displayMode: boolean) =>
  katex.renderToString(prepare(tex), { displayMode, throwOnError: false });

const math: TokenizerAndRendererExtension = {
  name: 'math',
  level: 'inline',
  start: (src) => { const i = src.indexOf('$'); return i < 0 ? undefined : i; },
  tokenizer(src) {
    /* $$…$$ is display maths; $…$ must hug its content and not be followed by a digit, so "$5 and $6" stays text */
    const m = /^\$\$([^$]+?)\$\$/.exec(src) ?? /^\$(?=\S)([^$\n]*?\S)\$(?!\d)/.exec(src);
    if (m) return { type: 'math', raw: m[0], text: m[1], display: m[0].startsWith('$$') };
    return undefined;
  },
  renderer: (token) => typeset(token.text, token.display),
};

marked.use({ extensions: [math] });
