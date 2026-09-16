import React, { useMemo } from 'react';
import katex from 'katex';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderKatexSafe(formula, isDisplay) {
  try {
    let clean = formula.trim();
    clean = clean.replace(/\\begin\{align\*?\}/g, '\\begin{aligned}');
    clean = clean.replace(/\\end\{align\*?\}/g, '\\end{aligned}');
    clean = clean.replace(/\\begin\{equation\*?\}/g, '\\begin{aligned}');
    clean = clean.replace(/\\end\{equation\*?\}/g, '\\end{aligned}');
    clean = clean.replace(/\\begin\{gather\*?\}/g, '\\begin{gathered}');
    clean = clean.replace(/\\end\{gather\*?\}/g, '\\end{gathered}');

    return katex.renderToString(clean, {
      displayMode: isDisplay,
      throwOnError: false,
      trust: false,
      strict: false,
    });
  } catch (err) {
    console.warn('KaTeX render error:', err);
    return `<code class="math-fallback">${escapeHtml(formula)}</code>`;
  }
}

export function MathRenderer({ content, displayMode = false, className = '' }) {
  const renderedHtml = useMemo(() => {
    if (!content) return '';
    if (displayMode) {
      return renderKatexSafe(String(content), true);
    }

    const text = String(content);
    const tokens = [];

    const saveToken = (rendered) => {
      const id = `%%%MATH_TOKEN_${tokens.length}%%%`;
      tokens.push(rendered);
      return id;
    };

    let processed = text;

    processed = processed.replace(/```(?:latex|math)\r?\n([\s\S]*?)```/gi, (_, math) => {
      const rendered = renderKatexSafe(math, true);
      return saveToken(`<div class="math-block">${rendered}</div>`);
    });

    processed = processed.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
      return saveToken(`<pre class="math-code-block"><code>${escapeHtml(code)}</code></pre>`);
    });
    processed = processed.replace(
      /\\begin\{(aligned|align\*?|equation\*?|gather\*?|matrix|pmatrix|bmatrix|vmatrix|cases)\}([\s\S]*?)\\end\{\1\}/g,
      (match) => {
        const rendered = renderKatexSafe(match, true);
        return saveToken(`<div class="math-block">${rendered}</div>`);
      }
    );
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      const rendered = renderKatexSafe(math, true);
      return saveToken(`<div class="math-block">${rendered}</div>`);
    });
    processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
      const rendered = renderKatexSafe(math, true);
      return saveToken(`<div class="math-block">${rendered}</div>`);
    });
    processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
      const rendered = renderKatexSafe(math, false);
      return saveToken(`<span class="math-inline">${rendered}</span>`);
    });
    processed = processed.replace(/(^|[^\\])\$([^\$\n\r]+?)\$/g, (match, prefix, math) => {
      if (!math.trim()) return match;
      const rendered = renderKatexSafe(math, false);
      return `${prefix}${saveToken(`<span class="math-inline">${rendered}</span>`)}`;
    });

    const parts = processed.split(/(%%%MATH_TOKEN_\d+%%%)/g);
    const formattedParts = parts.map((part) => {
      if (part.startsWith('%%%MATH_TOKEN_') && part.endsWith('%%%')) {
        return part;
      }

      let t = escapeHtml(part);
      t = t.replace(/^(?:---|___|\*\*\*)\s*$/gm, '<hr class="math-divider" />');

      t = t.replace(/^#### (.*?)$/gm, '<h5 class="math-h5">$1</h5>');
      t = t.replace(/^### (.*?)$/gm, '<h4 class="math-h4">$1</h4>');
      t = t.replace(/^## (.*?)$/gm, '<h3 class="math-h3">$1</h3>');
      t = t.replace(/^# (.*?)$/gm, '<h2 class="math-h2">$1</h2>');

      t = t.replace(/^&gt; (.*?)$/gm, '<blockquote class="math-quote">$1</blockquote>');

      t = t.replace(/^[•\-\*]\s+(.*?)$/gm, '<div class="math-list-item"><span class="math-bullet">•</span> <span>$1</span></div>');

      t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');

      t = t.replace(/(^|[^*])\*([^*]+?)\*/g, '$1<em>$2</em>');
      t = t.replace(/`([^`]+?)`/g, '<code class="math-inline-code">$1</code>');
      // Markdown links: [Title](url)
      t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, (_, label, url) => {
        return saveToken(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="math-link">${escapeHtml(label)}</a>`);
      });

      // Raw URLs: https://... or http://...
      t = t.replace(/\b(https?:\/\/[^\s<]+)/g, (url) => {
        const cleanUrl = url.replace(/[.,;!?)]+$/, '');
        const trailing = url.slice(cleanUrl.length);
        return `${saveToken(`<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="math-link">${escapeHtml(cleanUrl)}</a>`)}${trailing}`;
      });

      t = t.replace(/\r?\n\r?\n/g, '<div class="math-paragraph-spacer"></div>');

      t = t.replace(/\r?\n/g, '<br/>');

      return t;
    });

    let finalHtml = formattedParts.join('');

    tokens.forEach((rendered, idx) => {
      finalHtml = finalHtml.replaceAll(`%%%MATH_TOKEN_${idx}%%%`, () => rendered);
    });

    return finalHtml;
  }, [content, displayMode]);

  return (
    <div
      className={`math-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

export default MathRenderer;
