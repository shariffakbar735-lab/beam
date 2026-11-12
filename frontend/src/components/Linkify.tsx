import type { ReactNode } from "react";

const TRAILING_PUNCTUATION = /[.,;:!?)]$/;

/** Renders message text verbatim, turning URLs into real links (opens in a new tab). */
export default function Linkify({ text }: { text: string }) {
  const pattern = /(?:https?:\/\/|www\.)[^\s<>"']+/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    let url = match[0];
    let trailing = "";
    while (url.length > 0 && TRAILING_PUNCTUATION.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }

    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    if (url.length > 0) {
      nodes.push(
        <a
          key={`${match.index}-${url}`}
          href={url.startsWith("www.") ? `https://${url}` : url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="message-link-item"
          className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {url}
        </a>,
      );
    }
    if (trailing) nodes.push(trailing);
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}
