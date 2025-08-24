# Sobhan <KD/>

A small, local Flask-based app for creating, editing and previewing HTML/CSS/JS projects.  
It’s ideal for quick experiments, teaching, or building tiny static sites from a central interface.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running locally](#running-locally)
- [Using the app](#using-the-app)
- [Development](#development)
- [Packaging & Deployment](#packaging--deployment)
- [Publishing to GitHub](#publishing-to-github)
- [Recommended `.gitignore`](#recommended-gitignore)
- [Security & Privacy](#security--privacy)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)
- [Troubleshooting](#troubleshooting)

---

## Project Overview
Mini HTML Studio is a lightweight Flask application that exposes a simple UI for:
- Managing multiple small HTML projects (each project is a folder with `index.html`, optional `style.css` and `script.js`).
- Editing and previewing project files in-browser.
- Storing static helper data (CSS schema, tag attributes) for UI helpers and inspectors.

The repository already contains the server (`app.py`), templates and `static/` assets.

---

## Features
- Create / open / save small HTML projects.
- In-browser preview (iframe) and edit.
- Static assets served from `static/`.
- JSON resources (e.g., CSS schema) for in-app autocompletion or inspectors.
- Simple file structure suitable for publishing a single project as static site or running the Flask app for dynamic features.

---

## Project Structure (example)
