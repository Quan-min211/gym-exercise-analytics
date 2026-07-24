# AGENTS.md — Mandatory AI Coding Rules

> **READ THIS FILE BEFORE WRITING ANY CODE.**
> All AI agents (Copilot, Cursor, Claude Code, Codex, Gemini, etc.) must strictly adhere to 100% of the rules below.

---

## 1. Semantic HTML5 — 100% MANDATORY

### Core Principles

- **ABSOLUTELY NO** use of `<div>` or `<span>` when an appropriate Semantic HTML5 tag exists.
- Every page must use **100% Semantic HTML5** — no exceptions.
- `<div>` and `<span>` may only be used when **NO** semantic tag is suitable (e.g., pure CSS layout wrappers).

### Mandatory Semantic HTML5 Tags

| Purpose | Correct Tag | INCORRECT |
|---------|-------------|-----------|
| Page Layout | `<header>`, `<main>`, `<footer>`, `<aside>`, `<nav>` | `<div class="header">`, `<div class="footer">` |
| Article Content | `<article>`, `<section>` | `<div class="article">`, `<div class="section">` |
| Headings | `<h1>` → `<h6>` (proper hierarchy) | `<div class="title">`, `<span class="heading">` |
| Navigation List | `<nav>` + `<ul>` / `<ol>` | `<div class="nav">` |
| Captioned Image | `<figure>` + `<figcaption>` | `<div class="image-wrapper">` |
| Time | `<time datetime="...">` | `<span class="date">` |
| Text Markup | `<mark>`, `<strong>`, `<em>`, `<abbr>`, `<cite>`, `<code>` | `<span class="highlight">`, `<b>` (unless contextually correct) |
| Form | `<form>`, `<fieldset>`, `<legend>`, `<label>`, `<output>` | `<div class="form">` |
| Expandable Details| `<details>` + `<summary>` | `<div class="accordion">` |
| Embedded Content | `<video>`, `<audio>`, `<picture>`, `<source>` | `<div class="video-container">` (for wrappers use `<figure>`) |
| Data Tables | `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<caption>`, `<th scope="...">` | `<div class="table">` |
| Quotes | `<blockquote>`, `<q>`, `<cite>` | `<div class="quote">` |
| Address | `<address>` | `<div class="contact-info">` |
| Progress | `<progress>`, `<meter>` | `<div class="progress-bar">` |
| Dialog Content | `<dialog>` | `<div class="modal">` |
| Search | `<search>` | `<div class="search-wrapper">` |

### Heading Hierarchy Rules

```text
<h1> — EXACTLY 1 per page (main title)
  <h2> — Main sections
    <h3> — Sub-sections
      <h4> → <h6> — Deeper details
```

- **DO NOT** skip levels (e.g., using an `<h1>` followed by an `<h3>` without an `<h2>`).

### Standard Page Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Page description">
  <title>Page Title</title>
</head>
<body>
  <header>
    <nav aria-label="Main navigation">
      <ul><!-- navigation items --></ul>
    </nav>
  </header>

  <main>
    <article>
      <header>
        <h1>Main Title</h1>
        <time datetime="2026-01-01">January 1, 2026</time>
      </header>

      <section aria-labelledby="section-id">
        <h2 id="section-id">Section title</h2>
        <!-- content -->
      </section>

      <footer>
        <!-- article metadata -->
      </footer>
    </article>

    <aside aria-label="Related content">
      <!-- sidebar / related content -->
    </aside>
  </main>

  <footer>
    <address><!-- contact information --></address>
    <nav aria-label="Footer navigation">
      <ul><!-- footer links --></ul>
    </nav>
  </footer>
</body>
</html>
```

---

## 2. Accessibility (a11y) — Mandatory

- Every image must have a clear descriptive `alt` attribute (or `alt=""` if decorative).
- Every interactive element must have an `aria-label` or a visible label.
- Use `aria-labelledby` and `aria-describedby` when necessary.
- Form controls must be linked to a `<label>` via the `for`/`id` attributes.
- Keyboard navigation must be fully functional (visible focus, logical tab order).
- Color contrast must meet a minimum of 4.5:1 (AA) for regular text and 3:1 for large text.

---

## 3. CSS & Styling

- Prioritize **Vanilla CSS** (unless a specific framework is requested by the user).
- Use CSS Custom Properties (`--var`) for design tokens.
- Follow a mobile-first responsive design approach.
- Avoid inline styles unless they are dynamic (JavaScript-driven).

---

## 4. Pre-installed Project Tools

The following tools have been cloned into the project directory for reference and usage:

| Tool | Directory | Description |
|------|-----------|-------------|
| **Spec Kit** | `./spec-kit/` | Toolkit for Spec-Driven Development — define specs before coding. |
| **Taste Skill** | `./taste-skill/` | AI design skills — elevates UI quality and prevents generic AI designs. |
| **Impeccable** | `./impeccable/` | Design guidance for AI agents — 23 commands, 58 detector rules for frontend design. |

### Usage Instructions

- **Spec Kit**: Read `./spec-kit/` to understand the spec-driven workflow. Use specs to clearly define requirements before implementing them.
- **Taste Skill**: Reference the skills in `./taste-skill/skills/` to enhance UI design quality.
- **Impeccable**: Reference the rules in `./impeccable/` to ensure the design is neither generic nor boring.

---

## 5. Pre-Submission Checklist

- [ ] 100% Semantic HTML5 — no `<div>` / `<span>` used as substitutes for semantic tags.
- [ ] Correct heading hierarchy (`h1` → `h2` → `h3`, no skipped levels).
- [ ] Exactly **1** `<h1>` tag per page.
- [ ] All `<img>` tags have an `alt` text attribute.
- [ ] All form controls have an associated `<label>`.
- [ ] Proper page structure: `<header>` → `<main>` → `<footer>`.
- [ ] Use `<nav>` for navigation, `<article>` for independent content, and `<section>` for content groups.
- [ ] Fully responsive and mobile-first design.
- [ ] Accessibility complies with WCAG 2.1 AA standards.

---

> **Remember**: This file is the law. The AI must read and strictly adhere to it BEFORE writing any code.
