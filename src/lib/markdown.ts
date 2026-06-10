import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

// Clean up extra whitespace from Word exports
turndown.addRule('cleanBreaks', {
  filter: 'br',
  replacement: () => '\n',
});

/**
 * Convert a .docx File to Markdown string.
 * Uses mammoth (docx → HTML) then turndown (HTML → Markdown).
 */
export async function convertDocxToMarkdown(file: File): Promise<{
  markdown: string;
  title: string;
}> {
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1",
        "p[style-name='Heading 2'] => h2",
        "p[style-name='Heading 3'] => h3",
        "p[style-name='Heading 4'] => h4",
        "b => strong",
        "i => em",
      ],
    }
  );

  const html = result.value;
  const messages = result.messages;

  // Log conversion warnings (e.g. images that couldn't be converted)
  if (messages.length > 0) {
    console.warn('Mammoth conversion messages:', messages);
  }

  let markdown = turndown.turndown(html);

  // Clean up Word-specific artifacts
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')     // Collapse excessive blank lines
    .replace(/^\s+|\s+$/g, '');      // Trim

  const title = file.name.replace(/\.docx?$/i, '').replace(/[_-]/g, ' ');

  return { markdown, title };
}

/**
 * Render a Markdown string to sanitized HTML.
 */
export function markdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;

  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'code', 'pre', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}
