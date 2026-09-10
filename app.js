const posts = [
  { slug: "a-small-place-to-think", file: "posts/a-small-place-to-think.md" }
];

const list = document.querySelector("#post-list");
const count = document.querySelector("#post-count");
const postView = document.querySelector("#post-view");
const postContent = document.querySelector("#post-content");

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

async function loadPost(post) {
  const response = await fetch(post.file);
  if (!response.ok) throw new Error(`Could not load ${post.file}`);
  return { ...post, ...parseFrontmatter(await response.text()) };
}

function renderCard(post) {
  const card = document.createElement("a");
  card.className = "post-card";
  card.href = `#${post.slug}`;
  card.innerHTML = `
    <span class="post-meta">${post.attributes.date || ""} <span>·</span> ${post.attributes.reading || ""}</span>
    <h3>${post.attributes.title || post.slug}</h3>
    <p>${post.attributes.description || ""}</p>
    <span class="read-link">Read note <span aria-hidden="true">↗</span></span>
  `;
  return card;
}

function showPost(post) {
  list.parentElement.hidden = true;
  postView.hidden = false;
  postContent.innerHTML = `
    <div class="post-meta">${post.attributes.date || ""} <span>·</span> ${post.attributes.reading || ""}</div>
    <h1>${post.attributes.title || post.slug}</h1>
    <p class="post-description">${post.attributes.description || ""}</p>
    <div class="markdown-body">${DOMPurify.sanitize(marked.parse(post.body))}</div>
  `;
  if (window.MathJax) MathJax.typesetPromise([postContent]);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function start() {
  try {
    const loadedPosts = await Promise.all(posts.map(loadPost));
    count.textContent = `${loadedPosts.length} ${loadedPosts.length === 1 ? "note" : "notes"}`;
    loadedPosts.forEach((post) => list.appendChild(renderCard(post)));

    const slug = window.location.hash.slice(1);
    const selected = loadedPosts.find((post) => post.slug === slug);
    if (selected) showPost(selected);

    window.addEventListener("hashchange", () => {
      const next = loadedPosts.find((post) => post.slug === window.location.hash.slice(1));
      if (next) showPost(next);
      else {
        list.parentElement.hidden = false;
        postView.hidden = true;
      }
    });
  } catch (error) {
    list.innerHTML = `<p class="error">Writing could not be loaded. Run this site through a local server.</p>`;
    console.error(error);
  }
}

start();