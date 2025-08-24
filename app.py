# app.py — object-oriented, modular Flask app with docstrings and comments
from __future__ import annotations

import json
import logging
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from flask import (
    Flask,
    abort,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)
from werkzeug.utils import secure_filename

# -----------------------------------------------------------------------------
# Configuration & defaults
# -----------------------------------------------------------------------------
DEFAULT_SECRET_KEY = "change-me-before-prod"
DEFAULT_DESKTOP_SIZE: Tuple[int, int] = (1366, 768)

ALLOWED_UPLOAD_EXT: Dict[str, Optional[set]] = {
    "images": {"png", "jpg", "jpeg", "gif", "webp", "svg"},
    "videos": {"mp4", "webm", "ogg", "mov"},
    "audio": {"mp3", "avi", "wav", "ogg", "m4a"},
    # None means "allow any extension" for this category
    "files": None,
}


LOG = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# -----------------------------------------------------------------------------
# Utilities & helpers
# -----------------------------------------------------------------------------
def ensure_dir(path: Path) -> None:
    """Ensure a directory exists (like mkdir -p)."""
    path.mkdir(parents=True, exist_ok=True)


# -----------------------------------------------------------------------------
# Core managers (OOP)
# -----------------------------------------------------------------------------
@dataclass
class ProjectManager:
    """
    Manage filesystem operations for projects.

    Each project is represented by a directory under `projects_dir`.
    This class encapsulates creation, deletion, saving files, and serving paths.
    """

    base_dir: Path
    projects_dir: Path

    def __init__(self, base_dir: Optional[str] = None):
        base = Path(base_dir) if base_dir else Path(__file__).parent
        self.base_dir = base.resolve()
        self.projects_dir = (self.base_dir / "projects").resolve()
        ensure_dir(self.projects_dir)

    def list_projects(self) -> List[str]:
        """Return a list of project directory names."""
        if not self.projects_dir.exists():
            return []
        return sorted([p.name for p in self.projects_dir.iterdir() if p.is_dir()])

    def project_path(self, project: str) -> Path:
        """Return absolute path to a project directory."""
        return (self.projects_dir / secure_filename(project)).resolve()

    def exists(self, project: str) -> bool:
        """Return True if project folder exists."""
        return self.project_path(project).is_dir()

    def create_project(
        self, project: str, *, add_css: bool = False, add_js: bool = False
    ) -> Tuple[bool, str]:
        """
        Create a new project directory and optional starter files (index.html, style.css, script.js).

        Steps:
          - Sanitize the given project name.
          - Check if the project already exists.
          - Create the project directory.
          - Write a starter index.html file (English content).
          - Optionally add style.css and script.js if requested.

        :param project: Raw project name.
        :param add_css: Whether to create a default style.css file.
        :param add_js: Whether to create a default script.js file.
        :return: Tuple (success: bool, message: str).
        """
        project_name = secure_filename(project)
        if not project_name:
            return False, "Invalid project name"

        path = self.project_path(project_name)
        if path.exists():
            return False, "Project already exists"

        ensure_dir(path)

        # Default index.html content (English starter template)
        html_template = """<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>{title}</title>
        {css}
    </head>
    <body>
    <header class="site-header">
    <div class="container">
    <h1 class="site-title">Website Name</h1>
    <nav class="main-nav">
    <a href="#">Home</a>
    <a href="#about">About</a>
    <a href="#contact">Contact</a>
    </nav>
    </div>
    </header>

    <main class="site-main container">
    <section class="hero">
    <h2>Welcome!</h2>
    <p>This is a simple default template. You can start building your pages and editing styles from here.</p>
    <a class="btn" href="#about">Get Started</a>
    </section>

    <section id="about" class="content-card">
    <h3>About this project</h3>
    <p>Write your content here. You can add new HTML elements or change the styles in the CSS file.</p>
    </section>

    <section id="contact" class="content-card">
    <h3>Contact</h3>
    <p>Email: <a href="mailto:info@example.com">info@example.com</a></p>
    </section>
    </main>

    <footer class="site-footer">
    <div class="container">
    <p>© 2025 — All rights reserved.</p>
    </div>
    </footer>
    </body>
    {js}
    </html>
    """
        css_link = '<link rel="stylesheet" href="style.css">' if add_css else ""
        js_script = '<script src="script.js"></script>' if add_js else ""
        index_html = html_template.format(
            title=project_name, css=css_link, js=js_script
        )

        try:
            # Write index.html
            (path / "index.html").write_text(index_html, encoding="utf-8")

            # Optionally write style.css
            if add_css:
                default_css = """/* Short modern stylesheet for the provided template */
:root{
  --bg: #fbfdff;
  --card: #ffffff;
  --muted: #6b7280;
  --accent: #2563eb;
  --accent-2: #7c3aed;
  --radius: 10px;
  --gap: 16px;
  --container-w: 1100px;
}

*{box-sizing:border-box}
html,body{margin:0;padding:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#0f172a;background:var(--bg);line-height:1.45}
a{color:inherit;text-decoration:none}

/* layout */
.container{max-width:var(--container-w);margin:0 auto;padding:20px}
.site-header{background:linear-gradient(90deg,var(--card),#f8fbff);border-bottom:1px solid #e6eefc}
.site-header .container{display:flex;align-items:center;justify-content:space-between;gap:var(--gap)}
.site-title{font-size:1.1rem;font-weight:700}
.main-nav a{margin-left:14px;color:var(--muted);font-weight:600}
.main-nav a:hover{color:var(--accent)}

/* hero */
.hero{display:flex;flex-direction:column;gap:12px;align-items:flex-start;padding:48px;border-radius:var(--radius);background:linear-gradient(180deg,rgba(37,99,235,0.06),transparent)}
.hero h2{margin:0;font-size:1.6rem}
.hero p{margin:0;color:var(--muted)}
.btn{display:inline-block;margin-top:6px;padding:10px 14px;border-radius:8px;background:linear-gradient(90deg,var(--accent),var(--accent-2));color:#fff;font-weight:600;box-shadow:0 6px 18px rgba(37,99,235,0.12)}

/* cards / sections */
.content-card{background:var(--card);padding:18px;border-radius:12px;box-shadow:0 6px 18px rgba(2,6,23,0.04);margin-top:18px}
.content-card h3{margin:0 0 8px 0}
.content-card p{margin:0;color:var(--muted)}

/* footer */
.site-footer{margin-top:28px;padding:18px 0;color:var(--muted);font-size:0.9rem;text-align:center}

/* responsive */
@media (min-width:880px){
  .hero{flex-direction:row;justify-content:space-between;align-items:center}
  .hero h2{font-size:2rem}
}
@media (max-width:520px){
  .main-nav a{margin-left:10px;font-size:0.95rem}
  .container{padding:14px}
}

    """
                (path / "style.css").write_text(default_css, encoding="utf-8")

            # Optionally write script.js
            if add_js:
                (path / "script.js").write_text(
                    f"console.log('Project {project_name} script loaded');",
                    encoding="utf-8",
                )

            return True, "Project created"
        except Exception as e:
            LOG.exception("Failed to create project %s", project_name)
            return False, str(e)

    def delete_project(self, project: str) -> Tuple[bool, str]:
        """Remove a project directory entirely. Returns (ok, message)."""
        path = self.project_path(project)
        if not path.exists():
            return False, "not found"
        try:
            shutil.rmtree(path)
            return True, "deleted"
        except Exception as e:
            LOG.exception("Failed to delete project %s", project)
            return False, str(e)

    def save_index_html(self, project: str, html: str) -> Tuple[bool, str]:
        """Write html content to project's index.html."""
        path = self.project_path(project)
        if not path.exists():
            return False, "project not found"
        try:
            (path / "index.html").write_text(html, encoding="utf-8")
            return True, "ok"
        except Exception as e:
            LOG.exception("Failed to save index.html for %s", project)
            return False, str(e)

    def save_css(self, project: str, css: str) -> Tuple[bool, str]:
        """Write css content to project's style.css."""
        path = self.project_path(project)
        if not path.exists():
            return False, "project not found"
        try:
            (path / "style.css").write_text(css, encoding="utf-8")
            return True, "ok"
        except Exception as e:
            LOG.exception("Failed to save style.css for %s", project)
            return False, str(e)

    def serve_project_file(self, project: str, filename: str):
        """
        Return a Flask-compatible send_from_directory for a file inside the project.
        This does minimal path-safety checks (normalization).
        """
        path = self.project_path(project)
        if not path.exists():
            LOG.debug("serve_project_file: project path not exists: %s", path)
            abort(404)
        candidate = (path / filename).resolve()
        # Prevent path traversal outside project dir
        if not str(candidate).startswith(str(path)):
            LOG.warning("Attempt to access outside project dir: %s", candidate)
            abort(403)
        if not candidate.exists():
            LOG.debug("serve_project_file: candidate not found: %s", candidate)
            abort(404)
        # send relative to project path
        rel = os.path.relpath(candidate, path)
        return send_from_directory(str(path), rel)


@dataclass
class UploadManager:
    """
    Handle uploads into project subfolders with validation.

    - allowed_ext_map: mapping category -> set(ext)
    """

    allowed_ext_map: Dict[str, set]

    def validate_category(self, category: str) -> str:
        """
        Normalize and validate 'target' category.
        If category is known (images/videos/audio) return it; otherwise return a safe folder name.
        """
        if category in self.allowed_ext_map:
            return category
        # sanitize unknown category to a safe subfolder name
        return secure_filename(category) or "uploads"

    def is_allowed_extension(self, category: str, ext: str) -> bool:
        """
        Return True if extension is allowed for the given category.
        - If category not present in allowed_ext_map -> allow (legacy behavior).
        - If allowed_ext_map[category] is None -> explicitly allow any extension.
        - If it's a set -> require ext be in the set.
        """
        if category not in self.allowed_ext_map:
            # unknown category — allow by default (existing behavior)
            return True

        allowed = self.allowed_ext_map.get(category)
        if allowed is None:
            # explicit allow-all
            return True

        # otherwise allowed is expected to be a set of extensions
        return ext.lower() in allowed

    def save_upload(
        self, project_path: Path, file_storage, target_category: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Save an uploaded file into a project's subfolder. Returns (ok, rel_path or error).
        """
        filename = secure_filename(file_storage.filename or "")
        if not filename:
            return False, "empty filename"

        category = self.validate_category(target_category)
        dest_dir = project_path / category
        ensure_dir(dest_dir)

        # extension validation
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if category in self.allowed_ext_map and not self.is_allowed_extension(
            category, ext
        ):
            return False, "invalid extension"

        save_path = (dest_dir / filename).resolve()
        # path take care: ensure inside project path
        if not str(save_path).startswith(str(project_path.resolve())):
            return False, "invalid path"

        try:
            file_storage.save(str(save_path))
            rel = os.path.relpath(save_path, project_path).replace("\\", "/")
            return True, rel
        except Exception as e:
            LOG.exception("Failed to save upload to %s", save_path)
            return False, str(e)


@dataclass
class TagsLoader:
    """
    Load html_tags_attributes.json from a few sensible locations.
    Returns parsed JSON if found, otherwise None.
    """

    base_dir: Path

    def load(self) -> Tuple[Optional[dict], Optional[str]]:
        """
        Attempt to load the tags/attributes JSON from multiple candidate locations.
        Returns (data, path_used) or (None, None) if not found.
        """
        candidates = [
            self.base_dir / "html_tags_attributes.json",
            self.base_dir / "static" / "html_tags_attributes.json",
            self.base_dir / "static" / "data" / "html_tags_attributes.json",
        ]
        tried = []
        for p in candidates:
            tried.append(str(p))
            if p.exists():
                try:
                    with p.open("r", encoding="utf-8") as fh:
                        data = json.load(fh)
                    return data, str(p)
                except Exception as e:
                    LOG.exception("Failed to load tags file %s: %s", p, e)
                    return None, str(p)
        LOG.debug("TagsLoader tried candidates: %s", tried)
        return None, None


# -----------------------------------------------------------------------------
# Flask application factory
# -----------------------------------------------------------------------------
def create_app(config: Optional[dict] = None) -> Flask:
    """
    Create and configure the Flask application.

    This function registers routes and instantiates managers used by handlers.
    """
    app = Flask(__name__, static_folder="static", template_folder="templates")
    # Prefer reading a secret from environment; fallback to config default.
    # This ensures the Flask instance used by create_app has a usable secret key
    # so sessions/flash work correctly.
    import os
    import secrets

    # use existing config SECRET_KEY if already set above
    env_secret = os.environ.get("FLASK_SECRET") or os.environ.get("SECRET_KEY")
    if env_secret:
        app.config["SECRET_KEY"] = env_secret
    else:
        # keep the existing default if present, otherwise generate a short dev key.
        # Note: for production, set FLASK_SECRET env var and don't rely on autogenerated value.
        app.config.setdefault("SECRET_KEY", DEFAULT_SECRET_KEY)
        if app.config["SECRET_KEY"] == DEFAULT_SECRET_KEY:
            # generate a random dev-only key so local sessions work across the process lifetime
            # (will change on each restart—fine for dev).
            app.config["SECRET_KEY"] = secrets.token_hex(32)
            app.logger.warning(
                "No FLASK_SECRET set; using an autogenerated dev secret. Set FLASK_SECRET in production."
            )
    # Also set app.secret_key property explicitly to be safe (some older Flask versions check this)
    app.secret_key = app.config["SECRET_KEY"]

    # Basic configuration — can be overridden through config param
    app.config.setdefault("SECRET_KEY", DEFAULT_SECRET_KEY)
    app.config.setdefault("PROJECTS_DIR", str(Path(app.root_path) / "projects"))
    if config:
        app.config.update(config)

    # instantiate managers
    base = Path(app.root_path)
    pm = ProjectManager(str(base))
    um = UploadManager(ALLOWED_UPLOAD_EXT)
    tl = TagsLoader(base)

    # expose managers on app for debugging/testing convenience
    app.project_manager = pm  # type: ignore[attr-defined]
    app.upload_manager = um  # type: ignore[attr-defined]
    app.tags_loader = tl  # type: ignore[attr-defined]

    # ---- simple pages ----
    @app.route("/")
    def index():
        """Render main index page used by the front-end UI."""
        return render_template("index.html")

    @app.route("/create_project", methods=["POST"], endpoint="create_project")
    def create_project_route():
        """
        Create a new project via form POST.
        Expected fields: project_name, add_css, add_js.
        Returns redirect to index with flash message.
        """
        project_name = (request.form.get("project_name") or "").strip()
        add_css = request.form.get("add_css") == "on"
        add_js = request.form.get("add_js") == "on"

        if not project_name:
            flash("Please Enter Project Names")
            return redirect(url_for("index"))

        ok, msg = pm.create_project(project_name, add_css=add_css, add_js=add_js)
        if not ok:
            flash(msg)
        else:
            flash(f'The "{project_name}" Project maked Sussfully!')
        return redirect(url_for("index"))

    # ---- project list API ----
    @app.route("/api/projects", methods=["GET"])
    def api_projects():
        """Return JSON list of projects."""
        return jsonify(pm.list_projects())

    # ---- serve project files safely ----
    @app.route("/projects/<project>/<path:filename>", methods=["GET"])
    def serve_project_file(project: str, filename: str):
        """Serve a file that belongs to a project (safe-guarded)."""
        return pm.serve_project_file(project, filename)

    @app.route("/projects/<project>/index.html", methods=["GET"])
    def serve_project_index(project: str):
        """Serve project's index.html file (if exists)."""
        project_path = pm.project_path(project)
        index_file = project_path / "index.html"
        if not index_file.exists():
            abort(404)
        return send_from_directory(str(project_path), "index.html")

    # ---- save project HTML endpoint ----
    @app.route("/api/projects/<project>/save", methods=["POST"])
    def save_project_html(project: str):
        """Save posted HTML content to project's index.html."""
        data = request.get_json(force=True, silent=True) or {}
        if "html" not in data:
            return jsonify({"error": "no html provided"}), 400
        ok, msg = pm.save_index_html(project, data["html"])
        if ok:
            return jsonify({"ok": True})
        else:
            return jsonify({"error": msg}), 500

    # ---- delete project ----
    @app.route("/api/projects/<project>", methods=["DELETE"])
    def delete_project_route(project: str):
        """Delete an entire project folder."""
        ok, msg = pm.delete_project(project)
        if ok:
            return jsonify({"ok": True})
        return jsonify({"error": msg}), 500

    # ---- tags/attributes JSON loader endpoint ----
    @app.route("/api/tags_attributes", methods=["GET"])
    def api_tags_attributes():
        """
        Load and return html_tags_attributes.json from one of a few sensible locations.
        Returns 404 if not found.
        """
        data, path_used = tl.load()
        if data is None:
            return jsonify({"error": "not found"}), 404
        # debug log which file was used
        LOG.info("Serving tags_attributes from: %s", path_used)
        return jsonify(data)

    # ---- save css endpoint ----
    @app.route("/api/projects/<project>/save_css", methods=["POST"])
    def save_project_css(project: str):
        """Save posted CSS text to project's style.css."""
        data = request.get_json(force=True, silent=True) or {}
        if "css" not in data:
            return jsonify({"error": "no css provided"}), 400
        ok, msg = pm.save_css(project, data["css"])
        if ok:
            return jsonify({"ok": True})
        return jsonify({"error": msg}), 500

    # ---- upload endpoint ----
    @app.route("/api/projects/<project>/upload", methods=["POST"])
    def upload_project_file(project: str):
        """
        Save an uploaded file to the project's subfolder.
        Expected form-data fields:
          - file: the uploaded file
          - target: optional subfolder / category (images/videos/audio or custom)
        """
        if "file" not in request.files:
            return jsonify({"error": "no file"}), 400
        file = request.files["file"]
        target = request.form.get("target", "images")
        if file.filename == "":
            return jsonify({"error": "empty filename"}), 400

        project_path = pm.project_path(project)
        if not project_path.exists():
            return jsonify({"error": "project not found"}), 404

        ok, result = um.save_upload(project_path, file, target)
        if not ok:
            return jsonify({"error": result}), 400
        return jsonify({"ok": True, "path": result})

    # end create_app
    return app


# -----------------------------------------------------------------------------
# Entrypoint
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import os
    import secrets
    from pathlib import Path

    # Ensure a FLASK_SECRET exists for the process (dev-safe).
    # In production you should set FLASK_SECRET in the environment permanently.
    if not os.environ.get("FLASK_SECRET"):
        # generate a deterministic dev secret or set a readable one temporarily
        # (you may replace the token_hex with a fixed string for easier testing)
        os.environ["FLASK_SECRET"] = secrets.token_hex(32)
        LOG.info("FLASK_SECRET not set; generated a dev secret for this run.")

    application = create_app()
    # ensure projects dir exists before running
    ensure_dir(Path(application.config["PROJECTS_DIR"]))
    LOG.info("Starting Flask app (development mode)")
    # print secret to console for debugging (REMOVE in real usage)
    LOG.debug("Application SECRET_KEY (first 8 chars): %s", application.secret_key[:8])
    application.run(debug=True)
