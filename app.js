/* app.js — loads the notes listed below, renders the index as record rows
   grouped by year, and shows a single note when the URL hash matches its slug. */

const posts = [
  { slug: "a-small-place-to-think", file: "posts/a-small-place-to-think.md" },
  { slug: "buffer-overflow", file: "posts/buffer-overflow.md" }
];

const indexView = document.querySelector("#index-view");
const list = document.querySelector("#post-list");
const count = document.querySelector("#post-count");
const postView = document.querySelector("#post-view");
const postContent = document.querySelector("#post-content");
const pageIndex = document.querySelector("#page-index");
const siteTitle = document.title;

let current = null;   // the note on screen, or null on the index
let rendered = null;  // the note whose content is in #post-content

function parseFrontmatter(source) {
  const match = source.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
  if (!match) return { attributes: {}, body: source };

  const attributes = {};
  match[1].split("\n").forEach((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return;
    const key = line.slice(0, separator).trim();
    attributes[key] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
  });
  return { attributes, body: match[2] };
}

/* Images are written relative to the note file, the way a vault stores them
   (Attachments/…), but the page is served from the site root. Resolve those
   paths against the folder the note itself lives in. */
let assetBase = "";

/* Math. Notes write TeX between $...$ and $$...$$. Two things go wrong if
   that text reaches Markdown and MathJax untouched: Markdown treats the
   underscores and asterisks inside formulas as emphasis, and MathJax treats
   any stray "$" in prose (prices, shell prompts) as the start of a formula.
   So the tokenizers below lift math out before Markdown sees it and emit it
   with \(...\) and \[...\] delimiters, which are the only ones MathJax is
   told to look for. Anything else containing "$" is left alone. */
const mathBlock = {
  name: "mathBlock",
  level: "block",
  start(src) { return src.match(/^\$\$/m)?.index; },
  tokenizer(src) {
    const match = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n|$)/.exec(src);
    if (match) return { type: "mathBlock", raw: match[0], text: match[1].trim() };
  },
  renderer(token) { return `<p class="math-block">\\[${escapeHtml(token.text)}\\]</p>\n`; }
};

const mathInline = {
  name: "mathInline",
  level: "inline",
  start(src) { return src.indexOf("$") === -1 ? undefined : src.indexOf("$"); },
  tokenizer(src) {
    const display = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (display) return { type: "mathInline", raw: display[0], text: display[1].trim(), display: true };
    // No lookbehind: it is a parse-time SyntaxError on Safari/iOS < 16.4,
    // which would break this whole file. Forbid a trailing space in code instead.
    const inline = /^\$(?=\S)((?:\\\$|[^$\n])+?)\$(?![0-9$])/.exec(src);
    if (inline && !/\s$/.test(inline[1])) return { type: "mathInline", raw: inline[0], text: inline[1], display: false };
  },
  renderer(token) {
    return token.display
      ? `<span class="math-block">\\[${escapeHtml(token.text)}\\]</span>`
      : `<span class="math">\\(${escapeHtml(token.text)}\\)</span>`;
  }
};

marked.use({
  extensions: [mathBlock, mathInline],
  walkTokens(token) {
    if (token.type !== "image" || !assetBase) return;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(token.href)) return;
    token.href = assetBase + token.href;
  }
});

/* MathJax reads this before its bundle runs (both are deferred, app.js first).
   Only the delimiters emitted above are recognised; code and pre are skipped
   by MathJax's defaults, so "$" inside shell snippets is never typeset. */
window.MathJax = {
  tex: { inlineMath: [["\\(", "\\)"]], displayMath: [["\\[", "\\]"]] }
};

/* Three states, depending on how far MathJax has got when a note renders:
   the bundle has not run yet (its own first pass will pick the note up),
   it is running its startup (wait for that, then typeset), or it is ready. */
function typeset(element) {
  const mathjax = window.MathJax;
  if (mathjax.typesetPromise) {
    mathjax.typesetPromise([element]).catch((error) => console.error(error));
  } else if (mathjax.startup && mathjax.startup.promise) {
    mathjax.startup.promise.then(() => mathjax.typesetPromise([element])).catch((error) => console.error(error));
  }
}

function clearTypeset(element) {
  if (window.MathJax.typesetClear) MathJax.typesetClear([element]);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function uniqueId(base) {
  let id = base;
  let n = 2;
  while (document.getElementById(id) || posts.some((post) => post.slug === id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

function timestamp(post) {
  const value = Date.parse(post.attributes.date || "");
  return Number.isNaN(value) ? -Infinity : value;
}

function yearOf(post) {
  const match = (post.attributes.date || "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function metaLine(post) {
  return [post.attributes.date, post.attributes.reading].filter(Boolean).map(escapeHtml).join(" · ");
}

async function loadPost(post) {
  const response = await fetch(post.file);
  if (!response.ok) throw new Error(`Could not load ${post.file}`);
  return { ...post, ...parseFrontmatter(await response.text()) };
}

function setPageIndex(items) {
  pageIndex.innerHTML = items.length
    ? `<li><span class="sh">On this page</span></li>` +
      items.map((item) => `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.label)}</a></li>`).join("")
    : "";
}

function renderRow(post) {
  const item = document.createElement("li");
  item.innerHTML = `
    <a class="ios-row" href="#${escapeHtml(post.slug)}">
      <span class="ttl-row">
        <span class="ttl">${escapeHtml(post.attributes.title || post.slug)}</span>
        ${post.attributes.description ? `<span class="sub">${escapeHtml(post.attributes.description)}</span>` : ""}
      </span>
      <span class="right">
        <span class="meta">${metaLine(post)}</span>
        <span class="chev" aria-hidden="true">&rsaquo;</span>
      </span>
    </a>`;
  return item;
}

function renderList(loadedPosts) {
  const groups = new Map();
  loadedPosts.forEach((post) => {
    const year = yearOf(post);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(post);
  });

  list.innerHTML = "";
  groups.forEach((group, year) => {
    const block = document.createElement("div");
    block.className = "year-block";
    if (year) {
      const heading = document.createElement("h2");
      heading.textContent = year;
      block.appendChild(heading);
    }
    const rows = document.createElement("ul");
    rows.className = "ios-list";
    group.forEach((post) => rows.appendChild(renderRow(post)));
    block.appendChild(rows);
    list.appendChild(block);
  });

  count.textContent = `${loadedPosts.length} ${loadedPosts.length === 1 ? "note" : "notes"}`;
}

function showIndex() {
  current = null;
  postView.hidden = true;
  indexView.hidden = false;
  setPageIndex([{ id: "notes", label: "Notes" }]);
  document.title = siteTitle;
}

function renderPost(post) {
  rendered = post;
  assetBase = post.file.replace(/[^/]*$/, "");
  clearTypeset(postContent);
  const meta = metaLine(post);
  postContent.innerHTML = `
    <div class="page-head">
      ${meta ? `<p class="eyebrow">${meta}</p>` : ""}
      <h1>${escapeHtml(post.attributes.title || post.slug)}</h1>
      ${post.attributes.description ? `<p class="lede">${escapeHtml(post.attributes.description)}</p>` : ""}
    </div>
    <div class="markdown-body">${DOMPurify.sanitize(marked.parse(post.body))}</div>`;

  postContent.querySelectorAll(".markdown-body h2").forEach((heading) => {
    if (!heading.id) heading.id = uniqueId(slugify(heading.textContent));
  });
  typeset(postContent);
}

function revealPost(post) {
  current = post;
  indexView.hidden = true;
  postView.hidden = false;
  const headings = Array.from(postContent.querySelectorAll(".markdown-body h2"));
  setPageIndex(headings.map((heading) => ({ id: heading.id, label: heading.textContent })));
  document.title = `${post.attributes.title || post.slug} · ${siteTitle}`;
}

function showPost(post) {
  if (rendered !== post) renderPost(post);
  revealPost(post);
  window.scrollTo({ top: 0 });
}

function route(loadedPosts) {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  const post = loadedPosts.find((entry) => entry.slug === hash);
  if (post) {
    if (post !== current) showPost(post);
    return;
  }

  // A hash that points at a heading inside the last opened note (from the
  // side index, or the browser going back to it): keep or restore that note
  // and let the browser scroll to the heading.
  const target = hash ? document.getElementById(hash) : null;
  if (rendered && target && postView.contains(target)) {
    if (!current) {
      revealPost(rendered);
      target.scrollIntoView();
    }
    return;
  }

  if (current) {
    showIndex();
    window.scrollTo({ top: 0 });
  }
}

async function start() {
  // allSettled, not all: a single unreachable note should not blank the
  // entire index. Render every note that loaded; only show the error when
  // nothing loaded at all.
  const settled = await Promise.allSettled(posts.map(loadPost));
  const loadedPosts = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  settled.filter((s) => s.status === "rejected").forEach((s) => console.error(s.reason));

  if (!loadedPosts.length) {
    list.innerHTML = `<div class="notice"><p>The notes could not be loaded. Serve this folder over HTTP, for example <code>python3 -m http.server 8000</code>, then reload.</p></div>`;
    return;
  }

  loadedPosts.sort((a, b) => timestamp(b) - timestamp(a));
  renderList(loadedPosts);
  route(loadedPosts);
  window.addEventListener("hashchange", () => route(loadedPosts));
}

start();
