// GISMap Online may be installed in a subfolder (example.com/app/), so its pages never
// link from the server root: "/examples/" written in a page becomes a path
// relative to that page ("../examples/"), which works at any install location.
import { posix } from "node:path";

const ROOT_LINK = /(\b(?:href|src|action|poster)\s*=\s*)(["'])(\/(?!\/)[^"']*)\2/g;

/** `target` ("/examples/?x#y") as a link from the page at `page` ("discover/index.html"). */
export function relativeLink(page, target) {
  const [, path, rest = ""] = target.match(/^([^?#]*)(.*)$/);
  const from = posix.dirname(page);
  let link = posix.relative(from === "." ? "" : from, path.replace(/^\/+/, "") || ".");
  if (path.endsWith("/") && link && !link.endsWith("/")) link += "/";
  if (!link || link === ".") link = "./";
  else if (!link.startsWith(".")) link = `./${link}`;
  return link + rest;
}

/** The page's HTML with every root link (href, src, action, poster) made relative. */
export function relativizeHtml(page, html) {
  return html.replace(ROOT_LINK, (_, attribute, quote, target) => `${attribute}${quote}${relativeLink(page, target)}${quote}`);
}

const RELATIVE_LINK = /(\b(?:href|src|action|poster)\s*=\s*)(["'])(\.{1,2}\/[^"']*)\2/g;

/** The reverse, for checks written against root paths: "../examples/" in `page` becomes "/examples/". */
export function rootLinksHtml(page, html) {
  const from = posix.dirname(page);
  return html.replace(RELATIVE_LINK, (_, attribute, quote, link) => {
    const [, path, rest = ""] = link.match(/^([^?#]*)(.*)$/);
    let target = `/${posix.normalize(posix.join(from === "." ? "" : from, path))}`.replace(/\/\.$/, "/");
    if (path.endsWith("/") && !target.endsWith("/")) target += "/";
    return `${attribute}${quote}${target.replace(/^\/\.\/?/, "/")}${rest}${quote}`;
  });
}
