import { parse } from "node-html-parser";
import type { Check } from "../types.js";
import { section } from "./util.js";

export const seo: Check = async (ctx) => {
  const s = section("seo", "SEO & metadata");

  if (!ctx.html) {
    s.skip("The final response was not HTML");
    return s.done();
  }

  const root = parse(ctx.html);

  const title = root.querySelector("title")?.text.trim() ?? "";
  if (!title) s.add("critical", "Missing <title>");
  else if (title.length < 10) s.add("warning", `<title> is very short ("${title}")`);
  else if (title.length > 65) s.add("info", `<title> is ${title.length} chars — search results may truncate it`);
  else s.add("pass", `<title>: "${title}"`);

  const description = root
    .querySelector('meta[name="description"]')
    ?.getAttribute("content")
    ?.trim();
  if (!description) s.add("warning", 'Missing <meta name="description">');
  else if (description.length < 50 || description.length > 170) {
    s.add("info", `Meta description is ${description.length} chars (50–160 is the sweet spot)`);
  } else {
    s.add("pass", "Meta description present");
  }

  if (!root.querySelector('link[rel="canonical"]')) s.add("info", 'No <link rel="canonical">');
  else s.add("pass", "Canonical link present");

  const lang = root.querySelector("html")?.getAttribute("lang");
  if (!lang) s.add("warning", "<html> has no lang attribute");
  else s.add("pass", `Language declared: ${lang}`);

  if (!root.querySelector('meta[name="viewport"]')) {
    s.add("critical", "No responsive viewport meta tag");
  } else {
    s.add("pass", "Responsive viewport meta present");
  }

  const h1Count = root.querySelectorAll("h1").length;
  if (h1Count === 0) s.add("warning", "No <h1> on the page");
  else if (h1Count > 1) s.add("info", `${h1Count} <h1> elements (one is usually best)`);
  else s.add("pass", "Exactly one <h1>");

  const missingOg = ["og:title", "og:image"].filter(
    (prop) => !root.querySelector(`meta[property="${prop}"]`),
  );
  if (missingOg.length) {
    s.add("info", `Missing Open Graph tags: ${missingOg.join(", ")}`, "Affects link previews when the page is shared");
  }

  return s.done();
};
