# Html creatore

A small, local Flask-based app for creating, editing, and previewing HTML/CSS/JS projects.  
Ideal for quick experiments, teaching, or building tiny static sites from a single, central interface.

**Author**
- **Sobhan Kouchaki — SKD**

---

## Table of Contents
- [Html creatore](#html-creatore)
  - [Table of Contents](#table-of-contents)
  - [Project Overview](#project-overview)
  - [Features](#features)
  - [Menu \& Project workflow](#menu--project-workflow)

---

## Project Overview
**Html creatore** is a lightweight Flask application that provides a simple UI for:

- Managing multiple small HTML projects (each project is a folder with `index.html` and optional `style.css` / `script.js`).
- Editing and previewing project files directly in the browser.
- Holding static helper data (CSS schema, tag attributes) used by UI helpers and inspectors.

The repository includes the server (`app.py`), the front-end editor (`index.html`, `script.js`, `style.css`) and supporting `static/` and `projects/` folders.

---

## Features
- Create, open, save and manage multiple small HTML projects.
- In-browser editing of HTML/CSS/JS and live preview (iframe).
- Read-only centered **Preview** modal and full-screen **Load** editor mode.
- Upload assets (images, video) and auto-insert `src` paths.
- JSON resources (CSS schema, HTML tag attributes) for in-app autocompletion and inspectors.
- Lightweight Flask backend for serving files and simple APIs.
- Easy export of project folders for static hosting (GitHub Pages, Netlify, etc.).

---

## Menu & Project workflow
Html creatore centers around two main UI areas: the **Menu** (left sidebar) and the **Project Workspace** (main area).

**Menu (left sidebar)**
- Shows available projects and project controls:
  - **Create** — start a new project folder.
  - **Rename** — rename a project.
  - **Delete** — remove a project.
  - **Duplicate** — copy an existing project.
  - **Import** — add an existing project folder.
- Quick selectors to switch between **Preview** and **Load** modes.

**Project Workspace**
- **Preview mode**: quick, centered read-only modal or embedded iframe for viewing output.
- **Load mode**: full-screen editable workspace where you can:
  - Edit DOM elements, attributes and text directly.
  - Open and edit `style.css` and `script.js`.
  - Upload assets; uploaded file paths are automatically inserted into `src` attributes.
  - Save changes back to the project folder (`index.html`, etc.).

Typical workflow:
1. Create or select a project from the Menu.
2. Use **Preview** for quick inspection.
3. Switch to **Load** to edit and upload assets.
4. Save changes, export or publish the project.

---

if you can make it better i happy to see your version