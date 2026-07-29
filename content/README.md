# Writing stories

Every story is one ordinary Markdown file in `content/stories/`. You do not need to edit routes, components, story lists, imports, or page settings.

## Create a story

1. Copy `content/templates/story-template.md` into `content/stories/`.
2. Rename the copy. Use lowercase words separated by hyphens, for example `the-long-road.md`.
3. Edit the short metadata block between the `---` lines.
4. Write the story beneath the metadata in normal Markdown.
5. Run `npm run build`, or push the repository to GitHub and let GitHub Pages build it.

The file name is for your own convenience. The public URL comes from `slug`.

## Metadata

These fields are required:

- `title`: the story title.
- `slug`: the URL-friendly name, using lowercase letters, numbers, and hyphens.
- `description`: a short, plain summary used in the library and page description.
- `publishedAt`: a real date in `YYYY-MM-DD` format.
- `status`: `draft`, `published`, or `coming-soon`.

These fields are optional:

- `coverImage`: a path such as `/images/stories/my-cover.webp`.
- `subtitle`: a short line shown beneath the title.
- `updatedAt`: a later date in `YYYY-MM-DD` format.
- `coverAlt`: a useful description of the cover image.
- `kicker`: a short category or series label.

## Drafts and publication

- `draft` files are private working copies and never appear in the production output.
- Change `status` to `published` when the story is ready. The build automatically adds it to the Library and creates its story page.
- `coming-soon` files appear in the Library but cannot be opened.

Invalid metadata stops the build with a message naming the affected file and field. This prevents a broken story from being published silently.

## Chapters and contents

Write every chapter as a level-two heading:

```md
## Chapter One: The Beginning
```

The table of contents and chapter links are generated from those headings. Do not maintain a separate chapter list or manually divide the story into page objects.

The site supports ordinary Markdown headings, paragraphs, *italic text*, **bold text**, blockquotes, ordered and unordered lists, horizontal rules, images, and links.

## Cover images

1. Put the image in `public/images/stories/`.
2. Add its path to the story metadata:

   ```yaml
   coverImage: "/images/stories/my-story-cover.webp"
   ```

3. Add `coverAlt` when the image conveys information.

The build adjusts this path automatically for a GitHub Pages repository subdirectory.

## Preview locally

Install the project once with `npm install`, then run:

```sh
npm run dev
```

Open the local address printed in the terminal. Stop it with `Control-C`. Restart the command after editing a story to rebuild the preview.

## GitHub Pages

Push a published story to the `main` branch. The workflow in `.github/workflows/deploy-pages.yml` validates the Markdown, builds every static page, and publishes the `out/` directory. No server or database is used.

