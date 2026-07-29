# StoryWhiteBlue

StoryWhiteBlue is a small independent literature website for comfortable long-form reading. It uses Markdown for story content and generates ordinary static HTML, CSS, and JavaScript that can be published directly on GitHub Pages.

The site has no backend, database, authentication, API routes, private environment variables, server rendering, or runtime Node.js requirement.

## Technologies

- Node.js 20 or newer for the build
- Markdown with YAML frontmatter for stories
- `gray-matter` for frontmatter parsing
- `markdown-it` for Markdown rendering
- Plain semantic HTML, CSS, and a small progressive-enhancement script
- GitHub Actions and GitHub Pages for deployment

## Routes

The production build creates real files for:

- Home: `/`
- Library: `/library/`
- About: `/about/`
- Impressum and legal information: `/impressum/`
- Each published story: `/stories/<slug>/`

Compatibility redirects preserve the previous `reader.html` links and the earlier `/stories/kotuAdam/` route. Every story can be opened or refreshed directly on GitHub Pages without a rewrite rule.

## Repository structure

```text
.
├── .github/workflows/deploy-pages.yml
├── content/
│   ├── README.md
│   ├── site.json
│   ├── stories/
│   │   ├── example-draft.md
│   │   └── the-legend-of-alsbans.md
│   └── templates/
│       └── story-template.md
├── public/
│   └── images/
│       ├── social-card.png
│       └── stories/
├── scripts/
│   ├── build.mjs
│   ├── build-utils.mjs
│   ├── check-build.mjs
│   ├── content-loader.mjs
│   ├── dev.mjs
│   └── serve.mjs
├── src/
│   ├── site.js
│   └── styles.css
├── LICENSE
├── package.json
└── package-lock.json
```

Story text is stored in `content/stories/`. Story and social images are stored in `public/images/`. The generated website is written to `out/` and is intentionally ignored by Git.

## Install

```sh
npm install
```

For reproducible CI-style installation, use `npm ci` after the lock file exists.

## Local development

Build the site and start its local preview server:

```sh
npm run dev
```

Open the address printed in the terminal. Restart the command after editing content so the preview is rebuilt.

To build and preview separately:

```sh
npm run build
npm run preview
```

## Production build

```sh
npm run build
npm run check
```

The deployable static output is `out/`. The check confirms that required routes and assets exist, internal links respect the configured base path, machine-specific paths are absent, and draft stories are not exposed.

### Test a repository subdirectory locally

The build automatically derives the repository name in GitHub Actions. To test a project path manually:

```sh
BASE_PATH=/Stories/ npm run build
BASE_PATH=/Stories/ npm run check
BASE_PATH=/Stories/ npm run preview
```

This produces links such as `/Stories/library/` and `/Stories/images/stories/...`, so assets and navigation continue to work when the site is not hosted at the root domain.

## Add a story

1. Copy `content/templates/story-template.md` into `content/stories/`.
2. Rename the file.
3. Edit the short frontmatter block.
4. Write the story in normal Markdown.
5. Change `status` from `draft` to `published` when it is ready.
6. Run the build or push to `main`.

The build discovers the file, validates its metadata, calculates reading time, creates the table of contents from `##` headings, adds the story to the Library, and generates its static URL. No route, import, story array, or page-count file needs editing.

See [content/README.md](content/README.md) for the complete writing guide, supported statuses, image instructions, and metadata reference.

## GitHub Pages deployment

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to the `main` branch or run the workflow manually from the Actions tab.

The workflow installs from `package-lock.json`, runs the production build and output checks, uploads only `out/`, and deploys that artifact to GitHub Pages. Project repositories and `<username>.github.io` repositories receive the correct base path automatically.

## Content and configuration

- Edit site identity, author information, and preserved legal copy in `content/site.json`.
- Edit or add stories only in `content/stories/`.
- Put cover and inline story images in `public/images/stories/`.
- Do not edit `out/`; it is recreated on every build.

## Copyright and usage

Copyright © 2026 Erkan. All rights reserved.

The stories, prose, artwork, images, design, source code, documentation, and all other original materials in this repository are proprietary. No licence is granted. Copying, reproduction, modification, distribution, republication, commercial use, AI training, text or data mining, and creation of derivative works are prohibited without Erkan's prior written permission, except where applicable law expressly permits otherwise.

The public website may be accessed for personal reading only. See [LICENSE](LICENSE) for the complete terms.
