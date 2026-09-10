# writting

A small, public notebook for essays, experiments, and unfinished thoughts.

## Write a post

1. Add a Markdown file to `posts/`.
2. Start it with frontmatter for `title`, `date`, `reading`, and `description`.
3. Add the post file to the `posts` array in `app.js`.
4. Open `index.html` through a local server. Markdown, LaTeX between `$...$` or `$$...$$`, fenced code blocks, and regular Markdown images are supported.

For a local preview, run:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.
