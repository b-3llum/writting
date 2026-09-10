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

marked.use({
  walkTokens(token) {
    if (token.type !== "image" || !assetBase) return;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(token.href)) return;
    token.href = assetBase + token.href;
  }
});

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
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([postContent]);
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
  try {
    const loadedPosts = await Promise.all(posts.map(loadPost));
    loadedPosts.sort((a, b) => timestamp(b) - timestamp(a));
    renderList(loadedPosts);
    route(loadedPosts);
    window.addEventListener("hashchange", () => route(loadedPosts));
  } catch (error) {
    list.innerHTML = `<div class="notice"><p>The notes could not be loaded. Serve this folder over HTTP, for example <code>python3 -m http.server 8000</code>, then reload.</p></div>`;
    console.error(error);
  }
}

start();
