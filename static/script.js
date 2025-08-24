// static/script.js (complete, modified moveSelected to ensure element becomes last non-script before scripts)
(function(){
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    // ---------- DOM refs ----------
    const projectsList = document.getElementById("projects-list");
    const refreshBtn = document.getElementById("refresh-projects");
    const modalWrap = document.getElementById("preview-modal");
    const modalOverlay = document.getElementById("modal-overlay");
    const previewCard = document.getElementById("preview-card");
    const iframe = document.getElementById("project-iframe");
    const domTree = document.getElementById("dom-tree");
    const projTitle = document.getElementById("proj-title");
    const titleTextBox = document.getElementById("title-textbox");

    // toolbar / controls
    const addElementBtn = document.getElementById("add-element");
    const newTagSelect = document.getElementById("new-tag-type"); // input (with datalist) or select
    const tagsDatalist = document.getElementById("tags-datalist");
    const saveHtmlBtn = document.getElementById("save-html");
    const closeModalBtn = document.getElementById("close-modal");
    const deleteBtn = document.getElementById("delete-element");
    const moveUpBtn = document.getElementById("move-up");
    const moveDownBtn = document.getElementById("move-down");
    const applyAttrsBtn = document.getElementById("apply-attrs");

    // dynamic attr panel
    const attrDynamicList = document.getElementById("attr-dynamic-list");
    const uploadArea = document.getElementById("upload-area");
    const uploadInput = document.getElementById("upload-file-input");
    const uploadBtn = document.getElementById("upload-file-btn");
    const uploadTargetSelect = document.getElementById("upload-target-select");
    const uploadStatus = document.getElementById("upload-status");

    // legacy/static attr panel (fallback ids)
    const attrStatic = {
      info: document.getElementById("selected-info"),
      id: document.getElementById("attr-id"),
      class: document.getElementById("attr-class"),
      list: document.getElementById("attr-list"),
      inner: document.getElementById("attr-inner"),
    };

    // ---------- state ----------
    let currentMode = null;      // "preview" | "load"
    let currentProject = null;
    let selectedElement = null;  // element inside iframe
    let doc = null;              // iframe document when accessible
    let tagsAttrs = null;        // json from /api/tags_attributes
    let clickHandlerAttached = false;
    // ---------- additional state: history & helpers ----------
    let history = [];
    let historyPos = -1;
    const MAX_HISTORY = 60;
        // mapping from iframe DOM node -> tree node element (for reliable re-selection)
    let nodeToTreeNode = new WeakMap();
    // --- device toggle elements ---
    
    const iframeWrap       = document.getElementById('iframe-wrap');
    // ensure device button clicks call the function (if not already wired)
    const deviceDesktopBtn = document.getElementById('device-btn-desktop');
    const deviceMobileBtn  = document.getElementById('device-btn-mobile');
    if(deviceDesktopBtn) deviceDesktopBtn.addEventListener('click', (e)=>{ e.preventDefault(); setPreviewDevice('desktop'); });
    if(deviceMobileBtn)  deviceMobileBtn.addEventListener('click', (e)=>{ e.preventDefault(); setPreviewDevice('mobile'); });

    // when iframe finishes loading its project page, ensure device size is applied
    const projectIframe = document.getElementById('project-iframe');
    if(projectIframe){
      projectIframe.addEventListener('load', () => {
        // prefer currently active button, else desktop
        const active = document.querySelector('.device-btn.active');
        if(active && active.id === 'device-btn-mobile') setPreviewDevice('mobile');
        else setPreviewDevice('desktop');
      });
    }

    // when you open the modal (example function), call setPreviewDevice again
    // (if you already have a function that shows modal, add the following line in it)
    setPreviewDevice('desktop'); // call after modal shown so measurement correct

    // helper: set device (w/h in px) and toggle active class
    /**
 * Set preview size for a given device without forcing a fixed px width.
 * - The iframe width becomes responsive (100%) but is capped with maxWidth = w px.
 * - Height is clamped to the available area inside the preview-card so it doesn't overflow.
 * - Keeps iframe centered in its wrapper and toggles active classes on buttons.
 *
 * Expected globals (your existing code likely has these):
 *   projectIframe       -> element #project-iframe
 *   iframeWrap          -> wrapper element #iframe-frame-wrapper or .iframe-panel
 *   deviceDesktopBtn    -> desktop button element
 *   deviceMobileBtn     -> mobile button element
 *
 * Replace any previous implementation that set projectIframe.style.width = w + 'px'
 * with this function.
 */
  function adjustPreviewHeight() {
    const preview = document.getElementById('preview-card');
    const overlay = document.querySelector('.modal-overlay');
    if (!preview || !overlay) return;
    // small margin to avoid touching edges
    const margin = 32;
    const vh = window.innerHeight;
    preview.style.height = (vh - margin) + 'px';
    // ensure attr-panel can scroll to bottom (leave space for fixed action bar)
    const attr = document.getElementById('attr-panel');
    if (attr) {
      attr.style.paddingBottom = '120px';
    }
  }

  // call when opening preview / on resize
  window.addEventListener('resize', adjustPreviewHeight);
  // call once now (after modal is appended/displayed)
  adjustPreviewHeight();
  function syncInspectorHeight() {
    const attr = document.getElementById('attr-panel');
    if (!attr) return;
    const toolbarH = getComputedStyle(document.documentElement).getPropertyValue('--toolbar-height') || '64px';
    attr.style.height = `calc(100vh - ${toolbarH})`;
  }
  window.addEventListener('resize', syncInspectorHeight);
  document.addEventListener('DOMContentLoaded', syncInspectorHeight);
// If you open the preview modal via JS, call syncInspectorHeight() right after opening.

  function setPreviewDevice(device) {
    const iframe = document.getElementById('project-iframe');
    const previewCard = document.getElementById('preview-card');
    const wrapper = document.getElementById('iframe-frame-wrapper') || document.getElementById('iframe-wrap');
    const desktopBtn = document.getElementById('device-btn-desktop');
    const mobileBtn = document.getElementById('device-btn-mobile');
      
    if (!iframe || !previewCard) return;
      
    // read device dims (dataset on buttons)
    let w = 1366, h = 768;
    if (device === 'desktop') {
      if (desktopBtn && desktopBtn.dataset) {
        w = parseInt(desktopBtn.dataset.w || w, 10) || w;
        h = parseInt(desktopBtn.dataset.h || h, 10) || h;
      }
    } else {
      if (mobileBtn && mobileBtn.dataset) {
        w = parseInt(mobileBtn.dataset.w || 375, 10) || 375;
        h = parseInt(mobileBtn.dataset.h || 812, 10) || 812;
      }
    }
  
    // toggle active classes
    if (device === 'desktop') {
      desktopBtn && desktopBtn.classList.add('active');
      mobileBtn && mobileBtn.classList.remove('active');
    } else {
      mobileBtn && mobileBtn.classList.add('active');
      desktopBtn && desktopBtn.classList.remove('active');
    }
  
    // apply fixed pixel size to iframe (important)
    iframe.style.width = w + 'px';
    iframe.style.height = h + 'px';
    iframe.style.maxWidth = 'none';
    iframe.style.boxSizing = 'border-box';
  
    // center iframe in wrapper and allow scrollbars
    if (wrapper) {
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.overflow = 'auto';
    }
  
    // if previewCard is narrower (due to container), allow it to expand to fit iframe
    try {
      const leftPanel = previewCard.querySelector('.dom-panel');
      const rightPanel = previewCard.querySelector('.attr-panel') || previewCard.querySelector('.css-panel');
      const leftW = leftPanel ? Math.ceil(leftPanel.getBoundingClientRect().width) : 0;
      const rightW = rightPanel ? Math.ceil(rightPanel.getBoundingClientRect().width) : 0;
      const gaps = 12 * 2;
      const needed = w + leftW + rightW + gaps;
    
      // current computed maxWidth
      const comp = getComputedStyle(previewCard);
      const currentMax = parseInt(previewCard.style.maxWidth || comp.maxWidth.replace('px','')) || 0;
      if (needed > currentMax) {
        previewCard.style.maxWidth = needed + 'px';
        previewCard.style.overflowX = 'auto';
      } else {
        previewCard.style.maxWidth = ''; // let css handle default
        previewCard.style.overflowX = 'hidden';
      }
    } catch(e) {
      // ignore measurement errors
    }
  
    // reset wrapper scroll to top-left so user sees start of page
    if (wrapper) { wrapper.scrollLeft = 0; wrapper.scrollTop = 0; }
  }



    // wire click handlers (guard for existence)
    if(deviceDesktopBtn) deviceDesktopBtn.addEventListener('click', (e)=>{ e.preventDefault(); setPreviewDevice('desktop'); });
    if(deviceMobileBtn)  deviceMobileBtn.addEventListener('click', (e)=>{ e.preventDefault(); setPreviewDevice('mobile'); });

    function pushHistorySnapshot() {
      try {
        if(!doc) return;
        const snap = (doc.documentElement && doc.documentElement.outerHTML) ? doc.documentElement.outerHTML : null;
        if(!snap) return;
        // if current pos not at end, truncate forward history
        if(historyPos < history.length - 1) history = history.slice(0, historyPos + 1);
        history.push(snap);
        if(history.length > MAX_HISTORY) history.shift();
        historyPos = history.length - 1;
      } catch(e){ console.warn("pushHistorySnapshot failed", e); }
    }

    function restoreHistoryUndo() {
      try {
        if(historyPos <= 0) {
          alert("Nothing to undo");
          return;
        }
        historyPos--;
        const html = history[historyPos];
        if(!html) return;
        doc.open();
        doc.write(html);
        doc.close();
        // re-bind interactivity
        buildTree();

        // allow attachClickIntercept to reattach listeners
        clickHandlerAttached = false;
        attachClickIntercept();

        selectedElement = null;
        clearAttrPanel();

      } catch(e){ console.error("restoreHistoryUndo failed", e); }
    }

    
    // simple pretty-printer (basic, handles indentation and moves scripts to end-of-body)
    function prettyPrintHtml(rawHtml) {
      // 1) extract scripts and remove them
      const scripts = [];
      rawHtml = rawHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, function(m){
        scripts.push(m);
        return "";
      });
    
      // 2) ensure tags separated by newlines (simple)
      rawHtml = rawHtml.replace(/>\s*</g, ">\n<");
    
      const lines = rawHtml.split("\n").map(l => l.trim()).filter(Boolean);
      let indent = 0;
      const out = [];
      const selfClosingRE = /^(<(br|hr|img|input|meta|link|source|track|area|base|col|embed|wbr|param|command|keygen)(\s|>|\/))/i;
    
      lines.forEach(line => {
        if(/^<\/\w/.test(line)) {
          indent = Math.max(0, indent - 1);
        }
        const pad = "  ".repeat(indent);
        out.push(pad + line);
        if(/^<\w[^>]*[^\/]>/.test(line) && !selfClosingRE.test(line) && !/^<!(?:DOCTYPE|--)/i.test(line) && !/^<\?/.test(line) && !/\/>$/.test(line) && !/^<\/\w/.test(line) ) {
          if(!/<\/\w+>$/.test(line)) indent++;
        }
      });
    
      // 3) insert scripts before closing </body> if present, otherwise before </html>, otherwise append
      if(scripts.length) {
        const scriptLines = [];
        scriptLines.push(""); // blank line before scripts
        scripts.forEach(s => scriptLines.push(s));
      
        // find index of closing body or html tags (in out array)
        let insertAt = out.findIndex(l => /^<\/body>/i.test(l));
        if(insertAt === -1) insertAt = out.findIndex(l => /^<\/html>/i.test(l));
        if(insertAt === -1) {
          // no closing tags found — append at end
          out.push(...scriptLines);
        } else {
          // insert scripts right before insertAt
          out.splice(insertAt, 0, ...scriptLines);
        }
      }
    
      return out.join("\n");
    }


    // ---------- utility: identify overlay nodes so they are ignored ----------
    function isOverlayNode(node){
      try {
        if(!node) return false;
        const id = node.id || "";
        if(!id) return false;
        // covers "__editor_highlight_overlay" and "_editor_highlight_overlay" variants
        return id.indexOf("editor_highlight_overlay") !== -1 || id.indexOf("__editor_highlight_overlay") !== -1;
      } catch(e){ return false; }
    }

    // ---------- populate tag selector / datalist ----------
    function populateTagSelectorFromJSON(){
      if(!tagsAttrs || !newTagSelect) return;
      const isInput = newTagSelect.tagName && newTagSelect.tagName.toLowerCase() === "input";
      const existingValues = isInput
        ? (tagsDatalist ? Array.from(tagsDatalist.options).map(o => o.value) : [])
        : Array.from(newTagSelect.options).map(o => o.value);

      Object.keys(tagsAttrs).sort().forEach(tag => {
        if(tag === "global") return;
        if(existingValues.includes(tag)) return;
        if(isInput){
          if(tagsDatalist){
            const opt = document.createElement("option");
            opt.value = tag;
            tagsDatalist.appendChild(opt);
          }
        } else {
          const opt = document.createElement("option");
          opt.value = tag;
          opt.textContent = `<${tag}>`;
          newTagSelect.appendChild(opt);
        }
      });
    }

    // fetch tags/attributes JSON once (optional)
    fetch("/api/tags_attributes")
      .then(r => {
        if(!r.ok) throw new Error("tags_attributes not found");
        return r.json();
      })
      .then(data => {
        tagsAttrs = data;
        populateTagSelectorFromJSON();
      })
      .catch(err => {
        console.warn("tags_attributes JSON not available:", err);
      });

    // ---------- Parent overlay (no injection into iframe) ----------
    function ensureParentOverlay(){
      let ov = document.getElementById("__editor_highlight_overlay_parent");
      if(!ov){
        ov = document.createElement("div");
        ov.id = "__editor_highlight_overlay_parent";
        ov.style.position = "fixed";
        ov.style.pointerEvents = "none";
        ov.style.zIndex = 2147483000; // very high
        ov.style.border = "3px solid rgba(102,126,234,0.8)";
        ov.style.borderRadius = "6px";
        ov.style.boxSizing = "border-box";
        ov.style.transition = "all 0.08s ease";
        ov.style.display = "none";
        document.body.appendChild(ov);
      }
      return ov;
    }

    function showOverlayOn(el){
      if(!iframe || !el) return;
      const ov = ensureParentOverlay();
      if(!ov) return;
      try {
        // element rect relative to iframe viewport
        const elRect = el.getBoundingClientRect();
        // iframe rect relative to parent viewport
        const iframeRect = iframe.getBoundingClientRect();
        // compute parent viewport coords
        const top = iframeRect.top + elRect.top;
        const left = iframeRect.left + elRect.left;
        ov.style.top = `${top}px`;
        ov.style.left = `${left}px`;
        ov.style.width = `${Math.max(0, elRect.width)}px`;
        ov.style.height = `${Math.max(0, elRect.height)}px`;
        ov.style.display = "block";
      } catch(e){
        // probably cross-origin or removed element
        hideOverlay();
      }
    }

    function hideOverlay(){
      const ov = document.getElementById("__editor_highlight_overlay_parent");
      if(ov) ov.style.display = "none";
    }
        // update overlay position safely (called on scroll/resize)
    function updateOverlayPosition(){
      try {
        if(!selectedElement || !doc) { hideOverlay(); return; }
        if(!selectedElement.isConnected) { hideOverlay(); return; }
        showOverlayOn(selectedElement);
      } catch(e){ hideOverlay(); }
    }

    // attach parent window listeners (capture true to get scroll from anywhere)
    window.addEventListener("scroll", () => requestAnimationFrame(updateOverlayPosition), true);
    window.addEventListener("resize", () => requestAnimationFrame(updateOverlayPosition));

    // helper to attach iframe scroll/resize handlers (call when iframe doc available)
    function attachIframeScrollHandlers(){
      try {
        if(doc && doc.defaultView){
          doc.defaultView.addEventListener("scroll", () => requestAnimationFrame(updateOverlayPosition), true);
          doc.defaultView.addEventListener("resize", () => requestAnimationFrame(updateOverlayPosition));
        }
      } catch(e){ /* ignore cross-origin */ }
    }

    // ---------- Attribute panel (dynamic preferred, fallback static) ----------
    function clearAttrPanel(){
      if(attrDynamicList) attrDynamicList.innerHTML = "";
      if(attrStatic.info) attrStatic.info.textContent = "No element selected";
      if(attrStatic.id) attrStatic.id.value = "";
      if(attrStatic.class) attrStatic.class.value = "";
      if(attrStatic.list) attrStatic.list.value = "";
      if(attrStatic.inner) attrStatic.inner.value = "";
      // hide upload area
      if(uploadArea) uploadArea.style.display = "none";
      if(uploadStatus) uploadStatus.textContent = "";
      hideOverlay();
    }

    function fillAttrPanelDynamic(node){
      if(!attrDynamicList) return;
      attrDynamicList.innerHTML = "";
      // --- Attribute search header (inserted at top of attrDynamicList) ---
      const searchHeader = document.createElement('div');
      searchHeader.style.display = 'flex';
      searchHeader.style.gap = '8px';
      searchHeader.style.alignItems = 'center';
      searchHeader.style.marginBottom = '8px';

      const attrSearch = document.createElement('input');
      attrSearch.type = 'search';
      attrSearch.placeholder = 'Search attributes...'; // متن قابل تغییر به فارسی اگر خواستی
      attrSearch.id = 'attr-search-input';
      attrSearch.style.flex = '1';
      attrSearch.style.padding = '6px 8px';
      attrSearch.style.borderRadius = '6px';
      attrSearch.style.border = '1px solid #e6e9f2';
      attrSearch.autocomplete = 'off';

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.textContent = '✕';
      clearBtn.title = 'Clear';
      clearBtn.className = 'btn small muted';
      clearBtn.style.height = '34px';

      searchHeader.appendChild(attrSearch);
      searchHeader.appendChild(clearBtn);
      attrDynamicList.appendChild(searchHeader);

      // helper: filter attribute rows by name (case-insensitive)
      function filterAttrRows(q) {
        const rows = Array.from(attrDynamicList.querySelectorAll('.attr-row'));
        const normalized = (q || '').trim().toLowerCase();
        rows.forEach(r => {
          // prefer data-attrName on the input, fallback to label text
          const inp = r.querySelector('input[data-attr-name]');
          const lbl = r.querySelector('label');
          const name = (inp && inp.dataset && inp.dataset.attrName) ? inp.dataset.attrName.toLowerCase()
                      : (lbl ? lbl.textContent.toLowerCase() : '');
          if(!normalized) r.style.display = '';
          else r.style.display = (name.indexOf(normalized) !== -1 ? '' : 'none');
        });
      }

      // wire events
      attrSearch.addEventListener('input', (e) => { filterAttrRows(e.target.value); });
      clearBtn.addEventListener('click', () => { attrSearch.value = ''; filterAttrRows(''); attrSearch.focus(); });

      if(!node){
        if(attrStatic.info) attrStatic.info.textContent = "No element selected";
        return;
      }
      const tag = node.tagName ? node.tagName.toLowerCase() : "#text";
      if(attrStatic.info) attrStatic.info.textContent = `<${tag}>`;

      // gather global + specific attributes
      let list = [];
      if(tagsAttrs && tagsAttrs.global) list = list.concat(tagsAttrs.global);
      if(tagsAttrs && tagsAttrs[tag]) list = list.concat(tagsAttrs[tag]);

      // ensure id/class appear at top
      if(!list.includes("id")) list.unshift("id");
      if(!list.includes("class")) list.unshift("class");

      const seen = new Set();
      list = list.filter(a => { if(seen.has(a)) return false; seen.add(a); return true; });

      list.forEach(attrName => {
        const row = document.createElement("div");
        row.className = "attr-row";
        row.style.marginBottom = "8px";

        const label = document.createElement("label");
        label.style.fontWeight = "600";
        label.textContent = (attrName === "data-*" || attrName === "aria-*") ? `${attrName} (use exact name)` : attrName;
        row.appendChild(label);

        const input = document.createElement("input");
        input.type = "text";
        input.style.width = "100%";
        input.dataset.attrName = attrName;

        // prefill existing value
        let curVal = "";
        try {
          if(node.getAttribute && node.getAttribute(attrName) !== null){
            curVal = node.getAttribute(attrName);
          } else if(attrName === "id"){
            curVal = node.id || "";
          } else if(attrName === "class"){
            curVal = node.className || "";
          }
        } catch(e){ curVal = ""; }
        input.value = curVal;
        row.appendChild(input);

        // if src-like, show upload button
        const isSrcLike = ["src","poster","href","data"].includes(attrName) || attrName.endsWith("src") || attrName === "srcset";
        if(isSrcLike){
          const smallRow = document.createElement("div");
          smallRow.style.display = "flex";
          smallRow.style.gap = "8px";
          smallRow.style.marginTop = "6px";

          const uploadBtnLocal = document.createElement("button");
          uploadBtnLocal.type = "button";
          uploadBtnLocal.className = "btn small muted";
          uploadBtnLocal.textContent = "Upload file";
          uploadBtnLocal.addEventListener("click", () => {
            if(!uploadArea) return;
            uploadArea.style.display = "";
            let target = "images";
            if(tag === "video") target = "videos";
            if(tag === "audio") target = "audio";
            if(uploadTargetSelect) uploadTargetSelect.value = target;
            uploadArea.dataset.attrToFill = attrName;
          });
          smallRow.appendChild(uploadBtnLocal);

          const hint = document.createElement("div");
          hint.style.flex = "1";
          hint.style.color = "#4b5563";
          hint.style.fontSize = "13px";
          hint.textContent = "Upload will place relative path into this input.";
          smallRow.appendChild(hint);

          row.appendChild(smallRow);
        }

        attrDynamicList.appendChild(row);
      });

      // innerHTML editor
      const innerLabel = document.createElement("label");
      innerLabel.style.fontWeight = "600";
      innerLabel.textContent = "innerHTML / text";
      attrDynamicList.appendChild(innerLabel);

      const innerTA = document.createElement("textarea");
      innerTA.rows = 6;
      innerTA.style.width = "100%";
      innerTA.id = "attr-inner";
      innerTA.value = node.innerHTML;
      attrDynamicList.appendChild(innerTA);
    }

    function fillAttrPanel(node){
      if(attrDynamicList) fillAttrPanelDynamic(node);
      else {
        // fallback static
        if(!node){ clearAttrPanel(); return; }
        if(attrStatic.info) attrStatic.info.textContent = `<${node.tagName.toLowerCase()}>`;
        if(attrStatic.id) attrStatic.id.value = node.id || "";
        if(attrStatic.class) attrStatic.class.value = node.className || "";
        let attrs = [];
        if(node.attributes){
          Array.from(node.attributes).forEach(a => { if(a.name !== "id" && a.name !== "class") attrs.push(`${a.name}=${a.value}`); });
        }
        if(attrStatic.list) attrStatic.list.value = attrs.join("\n");
        if(attrStatic.inner) attrStatic.inner.value = node.innerHTML;
      }
    }
    // ------------------ Style tab: schema-driven inspector & tab switching ------------------
    // Paste this block IMMEDIATELY after the end of function fillAttrPanel(node) { ... }
      
    // load css schema once (schema file exists at /static/css-schema-full.json)
    let cssSchema = null;
    async function loadCssSchema() {
      try {
        const r = await fetch('/static/css-schema-full.json');
        if (!r.ok) throw new Error('schema not found');
        cssSchema = await r.json();
        console.log('CSS schema loaded');
      } catch (err) {
        console.warn('Failed to load css schema:', err);
        cssSchema = null;
      }
    }
    loadCssSchema();
    
    // helper: compute a usable selector for the element (prefer id, then first class, then tag)
    function computeSelectorForElement(el) {
      try {
        if (!el) return null;
        if (el.id) return `#${el.id}`;
        if (el.classList && el.classList.length) return `.${el.classList[0]}`;
        return el.tagName ? el.tagName.toLowerCase() : null;
      } catch (e) { return null; }
    }
    
    // apply a single property inline to selected element and attempt live-inject stylesheet
    function applyInlineProp(prop, value) {
      if (!selectedElement) return;
      try {
        selectedElement.style.setProperty(prop, value);
        // try to also ensure preview reflects full-css-editor (if present)
        try {
          if (doc) {
            let inj = doc.getElementById("__editor_injected_style");
            if (!inj) {
              inj = doc.createElement("style");
              inj.id = "__editor_injected_style";
              (doc.head || doc.documentElement).appendChild(inj);
            }
            const fe = document.getElementById('full-css-editor');
            inj.textContent = fe ? fe.value : (inj.textContent || "");
          }
        } catch (e) { /* ignore cross-origin or DOM errors */ }
      } catch (e) { console.warn('applyInlineProp error', e); }
    }
    
    // create a single property row (label + appropriate control) based on prop definition from schema
    // ----------------------- Helpers for color & number-unit controls -----------------------

    function parseColorString(s) {
      if(!s || typeof s !== 'string') return null;
      s = s.trim();
      const hexMatch = s.match(/^#([0-9a-f]{3,8})$/i);
      if(hexMatch){
        const h = hexMatch[1];
        if(h.length === 3) {
          const r = h[0]+h[0], g = h[1]+h[1], b = h[2]+h[2];
          return { r: parseInt(r,16), g: parseInt(g,16), b: parseInt(b,16), a: 1, hex: '#' + r+g+b, text: '#' + r+g+b };
        }
        if(h.length === 6){
          const r = h.slice(0,2), g = h.slice(2,4), b = h.slice(4,6);
          return { r: parseInt(r,16), g: parseInt(g,16), b: parseInt(b,16), a: 1, hex: '#' + h, text: '#' + h };
        }
        if(h.length === 8){
          const r = h.slice(0,2), g = h.slice(2,4), b = h.slice(4,6), a = h.slice(6,8);
          const alpha = parseInt(a,16) / 255;
          return { r: parseInt(r,16), g: parseInt(g,16), b: parseInt(b,16), a: alpha, hex: '#' + h.slice(0,6), text: '#' + h.slice(0,6) };
        }
      }
      let m = s.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)/i);
      if(m){
        return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]), a: (m[4] !== undefined ? parseFloat(m[4]) : 1), hex: rgbToHex(parseInt(m[1]),parseInt(m[2]),parseInt(m[3])), text: `rgba(${parseInt(m[1])}, ${parseInt(m[2])}, ${parseInt(m[3])}, ${(m[4] !== undefined ? parseFloat(m[4]) : 1)})` };
      }
      return null;
    }
    function toTwoHex(n){ const s = Math.round(Math.max(0, Math.min(255, n))).toString(16); return s.length === 1 ? '0' + s : s; }
    function rgbToHex(r,g,b){ return '#' + toTwoHex(r) + toTwoHex(g) + toTwoHex(b); }
    function clamp(v, a, b) { const n = parseFloat(v); if(isNaN(n)) return a; return Math.max(a, Math.min(b, n)); }

    // ----------------------- color control builder -----------------------
    function createColorControl(propName, propDef) {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex'; wrapper.style.flexDirection = 'column'; wrapper.style.gap = '6px';
    
      const row1 = document.createElement('div'); row1.style.display = 'flex'; row1.style.gap='8px'; row1.style.alignItems = 'center';
      const colorInput = document.createElement('input'); colorInput.type = 'color';
      const hexInput = document.createElement('input'); hexInput.type = 'text'; hexInput.placeholder = '#rrggbb or rgba()';
      hexInput.style.flex = '1';
      row1.appendChild(colorInput); row1.appendChild(hexInput);
      wrapper.appendChild(row1);
    
      const row2 = document.createElement('div'); row2.style.display='flex'; row2.style.gap='6px'; row2.style.alignItems='center';
      const rIn = document.createElement('input'); rIn.type='number'; rIn.min=0; rIn.max=255; rIn.style.width='64px';
      const gIn = document.createElement('input'); gIn.type='number'; gIn.min=0; gIn.max=255; gIn.style.width='64px';
      const bIn = document.createElement('input'); bIn.type='number'; bIn.min=0; bIn.max=255; bIn.style.width='64px';
      const aIn = document.createElement('input'); aIn.type='number'; aIn.min=0; aIn.max=1; aIn.step=0.01; aIn.style.width='64px';
      const alphaSlider = document.createElement('input'); alphaSlider.type='range'; alphaSlider.min=0; alphaSlider.max=1; alphaSlider.step=0.01; alphaSlider.style.flex='1';
      row2.appendChild(rIn); row2.appendChild(gIn); row2.appendChild(bIn); row2.appendChild(aIn); row2.appendChild(alphaSlider);
      wrapper.appendChild(row2);
    
      function setFromParsed(p){
        if(!p) return;
        rIn.value = p.r; gIn.value = p.g; bIn.value = p.b; aIn.value = typeof p.a === 'number' ? p.a : 1;
        alphaSlider.value = aIn.value;
        try { colorInput.value = p.hex || rgbToHex(p.r,p.g,p.b); } catch(e){}
        hexInput.value = (p.text && p.text.indexOf('rgba') === 0) ? `rgba(${p.r}, ${p.g}, ${p.b}, ${p.a})` : (p.hex || rgbToHex(p.r,p.g,p.b));
      }
    
      function applyFromComponents(){
        const r = clamp(rIn.value||0,0,255);
        const g = clamp(gIn.value||0,0,255);
        const b = clamp(bIn.value||0,0,255);
        const a = clamp(aIn.value||1,0,1);
        const rgbaText = `rgba(${r}, ${g}, ${b}, ${a})`;
        hexInput.value = rgbaText;
        try { colorInput.value = rgbToHex(r,g,b); } catch(e){}
        applyInlineProp(propName, rgbaText);
        // mark row dirty and store current value
        try {
          const rowEl = wrapper.closest('.prop-row');
          if (rowEl) { rowEl.dataset.dirty = '1'; rowEl.dataset.currentValue = rgbaText; }
        } catch(e){}
      }
    
      colorInput.addEventListener('input', () => {
        const parsed = parseColorString(colorInput.value);
        if(parsed) { setFromParsed(parsed); applyFromComponents(); }
      });
      hexInput.addEventListener('change', () => {
        const p = parseColorString(hexInput.value) || parseColorString(hexInput.value.replace(/\s+/g,''));
        if(p){ setFromParsed(p); applyFromComponents(); }
      });
      [rIn,gIn,bIn,aIn].forEach(i => i.addEventListener('change', () => { alphaSlider.value = aIn.value; applyFromComponents(); }));
      alphaSlider.addEventListener('input', () => { aIn.value = alphaSlider.value; applyFromComponents(); });
    
      try {
        if(selectedElement && window.getComputedStyle){
          const cs = window.getComputedStyle(selectedElement);
          const cur = cs.getPropertyValue(propName) || cs[propName] || selectedElement.style.getPropertyValue(propName) || '';
          const parsed = parseColorString(cur);
          if(parsed) setFromParsed(parsed);
        }
      } catch(e){}
    
      return wrapper;
    }

    // ----------------------- number+unit control builder -----------------------
    function createNumberUnitControl(propName, propDef) {
      const wrapper = document.createElement('div');
      wrapper.className = 'number-unit-control';
      wrapper.style.display = 'flex';
      wrapper.style.gap = '8px';
      wrapper.style.alignItems = 'center';

      const direct = document.createElement('input'); direct.type='number'; direct.style.width='80px'; direct.title='Direct value';
      const minInput = document.createElement('input'); minInput.type='number'; minInput.style.width='64px'; minInput.title='Min (slider)';
      const slider = document.createElement('input'); slider.type='range'; slider.style.flex='1';
      const maxInput = document.createElement('input'); maxInput.type='number'; maxInput.style.width='64px'; maxInput.title='Max (slider)'; maxInput.value = 100;
      const curInput = document.createElement('input'); curInput.type='number'; curInput.style.width='80px';
      const unitSel = document.createElement('select'); unitSel.style.width='80px';

      const units = (propDef && propDef.units && Array.isArray(propDef.units) && propDef.units.length) ? propDef.units : ['px','rem','em','%','vw','vh','s','ms','deg',''];
      units.forEach(u => { const o = document.createElement('option'); o.value = u; o.textContent = u || '(unitless)'; unitSel.appendChild(o); });

      // defaults
      minInput.value = 0;
      slider.min = 0;
      slider.max = 100;
      slider.value = 0;
      curInput.value = 0;
      direct.value = '';

      // helper to mark dirty on the row (use when value changed)
      function markDirty(val) {
        try {
          const rowEl = wrapper.closest('.prop-row');
          if (rowEl) {
            rowEl.dataset.dirty = '1';
            rowEl.dataset.currentValue = String(val);
          }
        } catch (e) { /* ignore */ }
      }
    
      // prefill from computed style if available
      try {
        if (selectedElement && window.getComputedStyle) {
          const cs = window.getComputedStyle(selectedElement);
          const raw = cs.getPropertyValue(propName) || selectedElement.style.getPropertyValue(propName) || '';
          if (raw && raw.trim()) {
            const m = raw.trim().match(/^([\-0-9.]+)\s*([a-z%]*)$/i);
            if (m) {
              const v = parseFloat(m[1]);
              const u = (m[2] || '');
              direct.value = v;
              curInput.value = v;
              slider.value = (isNaN(v) ? 0 : v);
              // set unitSel to matching option if present
              for (let i = 0; i < unitSel.options.length; i++) {
                if (unitSel.options[i].value === u) { unitSel.selectedIndex = i; break; }
              }
            }
          }
        }
      } catch (e) { /* ignore */ }
    
      // Event handlers — each one applies and marks dirty
    
      minInput.addEventListener('change', () => {
        // ensure slider range respects numeric values
        slider.min = minInput.value;
        // if slider is below min, clamp and reapply
        if (parseFloat(slider.value) < parseFloat(slider.min)) {
          slider.value = slider.min;
          curInput.value = slider.value;
        }
        const v = slider.value;
        applyInlineProp(propName, v + (unitSel.value || ''));
        markDirty(v + (unitSel.value || ''));
      });
    
      maxInput.addEventListener('change', () => {
        slider.max = maxInput.value;
        if (parseFloat(slider.value) > parseFloat(slider.max)) {
          slider.value = slider.max;
          curInput.value = slider.value;
        }
        const v = slider.value;
        applyInlineProp(propName, v + (unitSel.value || ''));
        markDirty(v + (unitSel.value || ''));
      });
    
      slider.addEventListener('input', () => {
        const v = slider.value;
        curInput.value = v;
        applyInlineProp(propName, v + (unitSel.value || ''));
        markDirty(v + (unitSel.value || ''));
      });
    
      curInput.addEventListener('change', () => {
        const minV = parseFloat(slider.min || 0);
        const maxV = parseFloat(slider.max || 100);
        const vNum = clamp(curInput.value, minV, maxV);
        curInput.value = vNum;
        slider.value = vNum;
        applyInlineProp(propName, vNum + (unitSel.value || ''));
        markDirty(vNum + (unitSel.value || ''));
      });
    
      direct.addEventListener('change', () => {
        const v = direct.value;
        if (v === '' || v === null) return;
        curInput.value = v;
        // clamp slider to min/max and set slider position
        const minV = parseFloat(slider.min || 0);
        const maxV = parseFloat(slider.max || 100);
        const clamped = Math.max(minV, Math.min(maxV, parseFloat(v)));
        slider.value = isNaN(clamped) ? slider.value : clamped;
        applyInlineProp(propName, v + (unitSel.value || ''));
        markDirty(v + (unitSel.value || ''));
      });
    
      unitSel.addEventListener('change', () => {
        // reapply current numeric value with new unit
        const v = (curInput.value !== '') ? curInput.value : (direct.value !== '' ? direct.value : slider.value);
        applyInlineProp(propName, v + (unitSel.value || ''));
        markDirty(v + (unitSel.value || ''));
      });
    
      // append in layout order
      wrapper.appendChild(direct);
      wrapper.appendChild(minInput);
      wrapper.appendChild(slider);
      wrapper.appendChild(maxInput);
      wrapper.appendChild(curInput);
      wrapper.appendChild(unitSel);
    
      return wrapper;
    }

    // ----------------------- createPropRow (uses above controls) -----------------------
    /**
 * Create a property row for the inspector.
 *
 * - Reads computed value (if any) and stores it in data-originalValue / data-currentValue.
 * - Produces an appropriate control based on propDef (colorpicker, number+unit, enum, box shorthand, fallback raw).
 * - Ensures that whenever a value is applied, the row is marked dirty and dataset.currentValue updated.
 *
 * @param {string} propName - CSS property name (e.g. "background-color")
 * @param {object} propDef  - property definition from schema (may contain ui, values, units, type)
 * @returns {HTMLElement} row element (with .prop-row class)
 */
  function createPropRow(propName, propDef) {
    const row = document.createElement('div');
    row.className = 'prop-row';
    row.dataset.prop = propName;
  
    // --- lifecycle metadata for this prop row (original/current/dirty) ---
    row.dataset.originalValue = '';
    row.dataset.currentValue = '';
    row.dataset.dirty = '0';
  
    // try to prefill original/current value from computed style
    try {
      if (selectedElement && window.getComputedStyle) {
        const cs = window.getComputedStyle(selectedElement);
        const initial = (cs.getPropertyValue(propName) || selectedElement.style.getPropertyValue(propName) || '').trim();
        row.dataset.originalValue = initial;
        row.dataset.currentValue = initial;
      }
    } catch (e) {
      row.dataset.originalValue = '';
      row.dataset.currentValue = '';
    }
  
    // label
    const label = document.createElement('label');
    label.className = 'prop-label';
    label.textContent = propName;
    row.appendChild(label);
  
    // control container
    const ctrl = document.createElement('div');
    ctrl.className = 'prop-control';
    row.appendChild(ctrl);
  
    // helper to mark this row dirty and store current value
    function markRowDirty(value) {
      try {
        row.dataset.dirty = '1';
        row.dataset.currentValue = (value === undefined || value === null) ? '' : String(value);
      } catch (e) { /* ignore dataset errors */ }
    }
  
    // pick UI hint and type
    const uiHint = (propDef && propDef.ui) || '';
    const valueType = (propDef && propDef.type) || '';
  
    // -------- Color control (uses createColorControl if available) --------
    if (uiHint === 'colorpicker' || String(propName).toLowerCase().includes('color')) {
      // createColorControl is expected to apply via applyInlineProp and mark row itself (via wrapper.closest)
      const colorCtrl = (typeof createColorControl === 'function')
        ? createColorControl(propName, propDef)
        : (function fallbackColor() {
            // minimal fallback: color input + text
            const w = document.createElement('div');
            w.style.display = 'flex'; w.style.gap = '8px'; w.style.alignItems = 'center';
            const color = document.createElement('input'); color.type = 'color';
            const txt = document.createElement('input'); txt.type = 'text'; txt.placeholder = '#rrggbb or rgba()';
            color.addEventListener('input', () => { txt.value = color.value; applyInlineProp(propName, txt.value); markRowDirty(txt.value); });
            txt.addEventListener('change', () => { applyInlineProp(propName, txt.value); markRowDirty(txt.value); });
            w.appendChild(color); w.appendChild(txt);
            return w;
          })();
        
      ctrl.appendChild(colorCtrl);
      return row;
    }
  
    // -------- Number + Unit control (uses createNumberUnitControl if available) --------
    if (uiHint === 'number+unit' || uiHint === 'number' ||
        (Array.isArray(valueType) && (valueType.includes('length') || valueType.includes('time') || valueType.includes('angle') || valueType.includes('percentage'))) ||
        /width|height|size|margin|padding|top|left|right|bottom|radius|gap|font-size|line-height/i.test(propName)) {
      const numCtrl = (typeof createNumberUnitControl === 'function')
        ? createNumberUnitControl(propName, propDef)
        : (function fallbackNumberUnit() {
            // simple fallback: number + unit select
            const w = document.createElement('div'); w.style.display = 'flex'; w.style.gap = '8px'; w.style.alignItems = 'center';
            const num = document.createElement('input'); num.type = 'number'; num.style.width = '88px';
            const unitSel = document.createElement('select');
            const units = (propDef && propDef.units && propDef.units.length) ? propDef.units : ['px','%','em','rem',''];
            units.forEach(u => { const o = document.createElement('option'); o.value = u; o.textContent = u || '(unitless)'; unitSel.appendChild(o); });
            num.addEventListener('change', () => { const v = num.value + unitSel.value; applyInlineProp(propName, v); markRowDirty(v); });
            unitSel.addEventListener('change', () => { const v = num.value + unitSel.value; applyInlineProp(propName, v); markRowDirty(v); });
            w.appendChild(num); w.appendChild(unitSel);
            return w;
          })();
        
      ctrl.appendChild(numCtrl);
      return row;
    }
  
    // -------- Enum / Select (keyword list) --------
    if (propDef && Array.isArray(propDef.values) && propDef.values.length) {
      const sel = document.createElement('select');
      const emptyOpt = document.createElement('option'); emptyOpt.value = ''; emptyOpt.textContent = '(unset)';
      sel.appendChild(emptyOpt);
      propDef.values.forEach(v => {
        const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o);
      });
      // preselect from computed/current value if present
      try {
        const cur = row.dataset.currentValue || '';
        if (cur) {
          for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === cur) { sel.selectedIndex = i; break; }
          }
        }
      } catch(e){}
    
      sel.addEventListener('change', () => {
        const val = sel.value;
        applyInlineProp(propName, val);
        markRowDirty(val);
      });
    
      ctrl.appendChild(sel);
      return row;
    }
  
    // -------- Box shorthand (margin / padding) with link/unlink --------
    if (propName === 'margin' || propName === 'padding') {
      const inputs = ['top','right','bottom','left'].map(()=> {
        const i = document.createElement('input'); i.type='number'; i.style.width='64px'; i.value='0';
        return i;
      });
      const linkBtn = document.createElement('button'); linkBtn.type='button'; linkBtn.className='link-button'; linkBtn.textContent='link';
      let linked = true;
      linkBtn.addEventListener('click', () => {
        linked = !linked;
        linkBtn.style.background = linked ? '#eef2ff' : '#fff';
        if (linked) { // copy first value to all
          inputs.slice(1).forEach(x => x.value = inputs[0].value);
          const v = `${inputs[0].value}px`;
          applyInlineProp(propName, v);
          markRowDirty(v);
        }
      });
    
      // change handler for each input
      inputs.forEach((inp) => {
        inp.addEventListener('change', () => {
          if (linked) {
            inputs.slice(1).forEach(x => x.value = inputs[0].value);
            const v = `${inputs[0].value}px`;
            applyInlineProp(propName, v);
            markRowDirty(v);
          } else {
            const v = `${inputs[0].value}px ${inputs[1].value}px ${inputs[2].value}px ${inputs[3].value}px`;
            applyInlineProp(propName, v);
            markRowDirty(v);
          }
        });
      });
    
      const wrap = document.createElement('div'); wrap.style.display='flex'; wrap.style.gap='6px'; wrap.append(...inputs); wrap.appendChild(linkBtn);
      ctrl.appendChild(wrap);
      return row;
    }
  
    // -------- Fallback: raw text input (accept any CSS value) --------
    const raw = document.createElement('input'); raw.type = 'text'; raw.placeholder = 'raw css value (e.g. calc(100% - 8px))';
    // prefill raw from currentValue
    try { if (row.dataset.currentValue) raw.value = row.dataset.currentValue; } catch(e){}
  
    raw.addEventListener('change', () => {
      const val = raw.value;
      applyInlineProp(propName, val);
      markRowDirty(val);
    });
  
    ctrl.appendChild(raw);
    return row;
  }


    // render the searchable properties list from cssSchema into attr-dynamic-list
    function renderPropertiesList(node) {
      const container = attrDynamicList || document.getElementById('attr-dynamic-list');
      if(!container) return;
      container.innerHTML = '';
    
      const header = document.createElement('div');
      header.style.display = 'flex'; header.style.gap = '8px'; header.style.marginBottom = '8px';
      const search = document.createElement('input'); search.type='search'; search.placeholder='Search properties...'; search.style.flex='1';
      header.appendChild(search);
      container.appendChild(header);
    
      const listWrap = document.createElement('div'); listWrap.id = 'props-list'; listWrap.style.maxHeight='380px'; listWrap.style.overflow='auto';
      container.appendChild(listWrap);
    
      if(!cssSchema || !cssSchema.properties) {
        const hint = document.createElement('div'); hint.className='muted'; hint.textContent = 'CSS schema not loaded yet.';
        listWrap.appendChild(hint); return;
      }
    
      const allProps = Object.keys(cssSchema.properties || {}).sort();
      const common = ['display','color','background-color','font-size','margin','padding','width','height','border','box-shadow','opacity'];
      const ordered = [...new Set([...common.filter(p => allProps.includes(p)), ...allProps])];
    
      function populate(filter='') {
        listWrap.innerHTML = '';
        ordered.filter(p => p.indexOf(filter) !== -1).forEach(p => {
          const def = cssSchema.properties[p] || {};
          const row = createPropRow(p, def);
          listWrap.appendChild(row);
        });
      }
      populate('');
      search.addEventListener('input', () => populate(search.value.trim()));
    }
    
    // Build CSS rule string from visible inspector rows (selector included)
    function buildRuleFromInspector(selector) {
      const listWrap = document.getElementById('props-list');
      if(!listWrap) return '';
      const props = [];
      listWrap.querySelectorAll('.prop-row').forEach(row => {
        const prop = row.dataset.prop;
        const colorInput = row.querySelector('input[type="color"]');
        const textInput = row.querySelector('input[type="text"]');
        const numInput = row.querySelector('input[type="number"]');
        const sel = row.querySelector('select');
        if (colorInput && colorInput.value) props.push(`${prop}: ${colorInput.value};`);
        else if (textInput && textInput.value) props.push(`${prop}: ${textInput.value};`);
        else if (numInput && numInput.value) props.push(`${prop}: ${numInput.value}${sel ? sel.value : ''};`);
        else if (sel && sel.value) props.push(`${prop}: ${sel.value};`);
        // box-input (four number inputs)
        const boxInputs = row.querySelectorAll('.prop-control input[type="number"]');
        if (boxInputs && boxInputs.length === 4) {
          const vals = Array.from(boxInputs).map(i => (i.value||'0') + 'px').join(' ');
          props.push(`${prop}: ${vals};`);
        }
      });
      if (props.length === 0) return '';
      return `${selector} {\n  ${props.join('\n  ')}\n}`;
    }
    /**
     * Build CSS rule body (only dirty properties if onlyDirty==true).
     * Returns a string like "prop: val;\n  prop2: val2;" (no selector wrapper).
     */
    function buildRuleFromInspectorBody(selector, onlyDirty = false) {
      const listWrap = document.getElementById('props-list');
      if(!listWrap) return '';
      const props = [];
      listWrap.querySelectorAll('.prop-row').forEach(row => {
        if (onlyDirty && row.dataset.dirty !== '1') return; // skip unchanged
        const prop = row.dataset.prop;
        if (!prop) return;
        // prefer dataset.currentValue (set when changed)
        const cur = (row.dataset.currentValue || '').trim();
        if (cur) { props.push(`${prop}: ${cur};`); return; }
      
        // fallback: read inputs inside row
        const colorInput = row.querySelector('input[type="color"]');
        const textInput = row.querySelector('input[type="text"]');
        const numInput = row.querySelector('input[type="number"]');
        const sel = row.querySelector('select');
        if (colorInput && colorInput.value) props.push(`${prop}: ${colorInput.value};`);
        else if (textInput && textInput.value) props.push(`${prop}: ${textInput.value};`);
        else if (numInput && numInput.value) {
          const unit = row.querySelector('select');
          props.push(`${prop}: ${numInput.value}${unit && unit.value ? unit.value : ''};`);
        } else if (sel && sel.value) props.push(`${prop}: ${sel.value};`);
      
        // box-input 4-number fallback
        const boxInputs = row.querySelectorAll('.prop-control input[type="number"]');
        if (boxInputs && boxInputs.length === 4) {
          const vals = Array.from(boxInputs).map(i => (i.value||'0') + 'px').join(' ');
          props.push(`${prop}: ${vals};`);
        }
      });
      if (props.length === 0) return '';
      return props.join('\n  ');
    }

    /**
     * Replace or append rule for selector inside cssText.
     * cssText: existing css content (string)
     * selector: selector string like ".myclass" or "#id"
     * body: rule body e.g. "prop: val;\n  prop2: val2;"
     * returns new cssText
     */
    /**
 * Merge or append rule for selector inside cssText.
 * - If selector exists: parse existing declarations and merge with `body` (body overwrites same props).
 * - If selector does not exist: append a new block.
 *
 * cssText: existing css content (string)
 * selector: selector string like ".myclass" or "#id"
 * body: rule body e.g. "prop: val;\n  prop2: val2;"
 * returns new cssText
 */
    function setRuleForSelectorInCss(cssText, selector, body) {
      if (!cssText) cssText = '';
    
      // parse body string into map { prop: value }
      function parseBodyToMap(b) {
        const map = {};
        if (!b) return map;
        b.split(';').map(s => s.trim()).filter(Boolean).forEach(pair => {
          const idx = pair.indexOf(':');
          if (idx <= 0) return;
          const p = pair.slice(0, idx).trim();
          const v = pair.slice(idx + 1).trim();
          if (p) map[p] = v;
        });
        return map;
      }
    
      // serialize map back to body string (stable ordering: existing keys then new keys)
      function mapToBody(map) {
        return Object.keys(map).map(k => `${k}: ${map[k]};`).join('\n  ');
      }
    
      // escape selector for regex
      const esc = selector.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const re = new RegExp(esc + '\\s*\\{[\\s\\S]*?\\}', 'm');
    
      // parse incoming new body to map (these should overwrite existing)
      const newMap = parseBodyToMap(body);
    
      if (re.test(cssText)) {
        // extract existing block
        const match = cssText.match(re);
        const existingBlock = match ? match[0] : null;
        // extract inner body text
        let inner = '';
        if (existingBlock) {
          const m2 = existingBlock.match(/\{\s*([\s\S]*?)\s*\}$/);
          if (m2 && m2[1] !== undefined) inner = m2[1];
        }
        const existingMap = parseBodyToMap(inner);
      
        // merge: existingMap keys kept, overwritten by newMap
        const merged = Object.assign({}, existingMap, newMap);
      
        const block = `${selector} {\n  ${mapToBody(merged)}\n}`;
      
        return cssText.replace(re, block);
      } else {
        // no existing selector — just append
        const block = `${selector} {\n  ${mapToBody(newMap)}\n}`;
        return cssText.trim() + (cssText.trim() ? '\n\n' : '') + block + '\n';
      }
    }


    // render main style inspector panel for a node (calls renderPropertiesList)
    function renderStyleInspector(node) {
      const container = attrDynamicList || document.getElementById('attr-dynamic-list');
      if(!container) return;
      container.innerHTML = '';
    
      const selector = computeSelectorForElement(node) || (node && node.tagName ? node.tagName.toLowerCase() : '(none)');
    
      const head = document.createElement('div');
      head.className = 'inspector-section';
      head.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
                          <div><strong>Selected:</strong> <code style="font-family:monospace">${selector}</code></div>
                          <div style="font-size:13px;color:#475569">${node ? node.tagName.toLowerCase() : ''}</div>
                        </div>`;
      container.appendChild(head);
    
      // properties list (searchable)
      renderPropertiesList(node);
    
      // actions
      const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px'; actions.style.marginTop='10px';
      const applyInlineBtn = document.createElement('button'); applyInlineBtn.className='btn small primary'; applyInlineBtn.textContent = 'Apply inline';
      const applyStyleBtn = document.createElement('button'); applyStyleBtn.className='btn small'; applyStyleBtn.textContent = 'Apply to stylesheet';
      actions.appendChild(applyInlineBtn); actions.appendChild(applyStyleBtn);
      container.appendChild(actions);
    
      applyInlineBtn.addEventListener('click', () => {
        const sel = selector;
        const rule = buildRuleFromInspector(sel);
        if (!rule) return alert('No properties set');
        // parse and apply inline directly
        const body = rule.replace(/^[^{]+\{/, '').replace(/\}$/, '').trim();
        body.split(';').map(s=>s.trim()).filter(Boolean).forEach(pair => {
          const idx = pair.indexOf(':');
          if (idx > 0) {
            const p = pair.slice(0, idx).trim();
            const v = pair.slice(idx+1).trim();
            try { if (node) node.style.setProperty(p, v); } catch(e){}
          }
        });
        alert('Applied inline (preview updated).');
      });
    
      // Replace the existing applyStyleBtn click listener with this complete version
      applyStyleBtn.addEventListener('click', async () => {
        // selector variable should be in scope where this listener is defined
        const sel = selector;
        // Build only the changed properties' body (requires buildRuleFromInspectorBody to exist)
        const body = (typeof buildRuleFromInspectorBody === 'function')
          ? buildRuleFromInspectorBody(sel, true)
          : (typeof buildRuleFromInspector === 'function' ? buildRuleFromInspector(sel) : '');
      
        if (!body || !body.trim()) {
          alert('No changed properties to save.');
          return;
        }
      
        // Ensure we have a textarea editor to show/save the full stylesheet
        let fe = document.getElementById('full-css-editor');
        if (!fe) {
          fe = document.createElement('textarea');
          fe.id = 'full-css-editor';
          fe.rows = 10;
          fe.style.width = '100%';
          fe.style.marginTop = '8px';
          // container should be the inspector container in scope; fallback to document.body
          const host = (typeof container !== 'undefined' && container) ? container : document.body;
          host.appendChild(fe);
        }
      
        // Merge this selector's new body into existing CSS text using helper (setRuleForSelectorInCss)
        const currentCss = fe.value || '';
        const newCss = (typeof setRuleForSelectorInCss === 'function')
          ? setRuleForSelectorInCss(currentCss, sel, body)
          : (currentCss + "\n\n" + `${sel} {\n  ${body}\n}`);
      
        // update editor and live preview (iframe)
        fe.value = newCss;
        try {
          if (typeof doc !== 'undefined' && doc) {
            let styleEl = doc.getElementById('__editor_injected_style');
            if (!styleEl) {
              styleEl = doc.createElement('style');
              styleEl.id = '__editor_injected_style';
              (doc.head || doc.documentElement).appendChild(styleEl);
            }
            styleEl.textContent = newCss;
          }
        } catch (e) {
          // ignore preview injection errors but log
          console.warn('Preview style injection failed', e);
        }
      
        // Determine project name to save into
        let projectName = window.currentProject || window.selectedProject || document.body.dataset.project || null;
        if (!projectName) {
          const m = location.pathname.match(/\/projects\/([^\/]+)/);
          if (m && m[1]) projectName = decodeURIComponent(m[1]);
        }
        if (!projectName) {
          projectName = prompt('Project name to save CSS into (required):');
        }
        if (!projectName) {
          alert('Project name is required to save CSS.');
          return;
        }
      
        // POST CSS to backend save endpoint
        try {
          const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/save_css`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ css: newCss }),
          });
          const j = await res.json().catch(()=>null);
        
          if (res.ok && j && j.ok) {
            alert('CSS saved to project successfully.');
          
            // Clear dirty flags for rows that were saved
            try {
              document.querySelectorAll('.prop-row').forEach(r => {
                if (r.dataset && r.dataset.dirty === '1') {
                  r.dataset.dirty = '0';
                  // update originalValue so next changes are compared to this saved value
                  r.dataset.originalValue = r.dataset.currentValue || r.dataset.originalValue || '';
                }
              });
            } catch (e) { /* ignore dataset clearing errors */ }
          
          } else {
            console.warn('save_css response', j, res.status, res.statusText);
            alert('Failed to save CSS: ' + (j && j.error ? j.error : res.statusText || 'unknown error'));
          }
        } catch (err) {
          console.error('save_css error', err);
          alert('Failed to save CSS: ' + (err && err.message ? err.message : String(err)));
        }
      });

    }
    
    // ---- Tab switching: make HTML tab default, Style tab will replace right panel behavior ----
    const tabHtmlBtn = document.getElementById('tab-html');
    const tabStyleBtn = document.getElementById('tab-style');
    let originalFillAttrPanel = null;
    
    function activateHtmlTabBehavior() {
      if (!tabHtmlBtn || !tabStyleBtn) return;
      tabHtmlBtn.classList.add('active'); tabStyleBtn.classList.remove('active');
      // restore original fillAttrPanel (if we wrapped it)
      if (originalFillAttrPanel) {
        try { window.fillAttrPanel = originalFillAttrPanel; fillAttrPanel = originalFillAttrPanel; } catch(e){}
        originalFillAttrPanel = null;
      }
      // re-render current selection in HTML attribute mode
      if (selectedElement) try { fillAttrPanel(selectedElement); } catch(e){}
    }
    
    function activateStyleTabBehavior() {
      if (!tabHtmlBtn || !tabStyleBtn) return;
      tabStyleBtn.classList.add('active'); tabHtmlBtn.classList.remove('active');
      // save original and override fillAttrPanel to render style-inspector instead
      if (!originalFillAttrPanel) originalFillAttrPanel = window.fillAttrPanel || fillAttrPanel;
      try {
        fillAttrPanel = function(node){ renderStyleInspector(node); };
      } catch(e){ console.warn('Could not override fillAttrPanel', e); }
      // render inspector immediately for current selection
      if (selectedElement) try { renderStyleInspector(selectedElement); } catch(e){}
    }
    
    // wire clicks (guard for existence)
    if (tabHtmlBtn) tabHtmlBtn.addEventListener('click', activateHtmlTabBehavior);
    if (tabStyleBtn) tabStyleBtn.addEventListener('click', activateStyleTabBehavior);
    
    // ensure that selecting an element updates panel according to active tab:
    // note: selectElement in file calls fillAttrPanel(selectedElement) — our override above will make it show style inspector when style tab active.
    
    // End of Style tab block
    // ---------------------------------------------------------------------------------------
    
    // ---------- Projects list ----------
    function loadProjects(){
      if(!projectsList) return;
      fetch("/api/projects")
        .then(r => r.json())
        .then(list => {
          projectsList.innerHTML = "";
          if(!list || !list.length){
            const no = document.createElement("div");
            no.className = "muted";
            no.textContent = "No projects found";
            projectsList.appendChild(no);
            return;
          }
          list.forEach(name => {
            const row = document.createElement("div");
            row.className = "project-item";

            const title = document.createElement("div");
            title.textContent = name;
            title.className = "project-name";

            const actions = document.createElement("div");
            actions.className = "project-actions";

            const previewBtn = document.createElement("button");
            previewBtn.className = "btn small";
            previewBtn.textContent = "Preview";
            previewBtn.onclick = () => openModal(name, "preview");

            const loadBtn = document.createElement("button");
            loadBtn.className = "btn small muted";
            loadBtn.textContent = "Load";
            loadBtn.onclick = () => openModal(name, "load");

            const delBtn = document.createElement("button");
            delBtn.className = "btn small danger";
            delBtn.textContent = "Delete";
            delBtn.onclick = () => {
              if(!confirm(`Delete project "${name}"?`)) return;
              fetch(`/api/projects/${encodeURIComponent(name)}`, { method: "DELETE" })
                .then(r => r.json())
                .then(res => {
                  if(res.ok) { loadProjects(); alert("Deleted"); }
                  else alert("Delete failed");
                }).catch(()=>alert("Delete failed"));
            };

            actions.appendChild(previewBtn);
            actions.appendChild(loadBtn);
            actions.appendChild(delBtn);

            row.appendChild(title);
            row.appendChild(actions);
            projectsList.appendChild(row);
          });
        }).catch(err=>{
          console.error("Failed to load projects:", err);
          projectsList.innerHTML = "<div class='muted'>Failed to load projects</div>";
        });
    }

    if(refreshBtn) refreshBtn.addEventListener("click", loadProjects);
    loadProjects();

    // ---------- Open / Close modal ----------
    function openModal(projectName, mode = "preview"){
      currentProject = projectName;
      window.currentProject = projectName;
      currentMode = mode;
      if(projTitle) projTitle.textContent = `${mode === "load" ? "Load" : "Preview"} — ${projectName}`;
      if(modalWrap){
        modalWrap.classList.remove("modal-hidden");
        modalWrap.style.display = "block";
        // after showing modal:
        if (typeof setPreviewDevice === 'function') {
          setPreviewDevice('desktop'); // default to desktop when modal opens
        }

      }

      if(mode === "load"){
        if(previewCard) { previewCard.classList.remove("preview-only"); previewCard.classList.add("fullscreen"); }
        toggleControls(true);
        if(iframe) iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
        if(attrDynamicList) attrDynamicList.style.display = "";
        if(domTree) domTree.style.display = "";
      } else {
        if(previewCard) { previewCard.classList.remove("fullscreen"); previewCard.classList.add("preview-only"); }
        toggleControls(false);
        if(iframe) iframe.setAttribute("sandbox", "");
        if(attrDynamicList) attrDynamicList.style.display = "none";
        if(domTree) domTree.style.display = "none";
      }
      if(iframe) iframe.src = `/projects/${encodeURIComponent(projectName)}/index.html`;
      // try to fetch the project's style.css into full-css-editor (non-blocking)
      fetch(`/projects/${encodeURIComponent(projectName)}/style.css`).then(r => {
        if(!r.ok) throw new Error('no css');
        return r.text();
      }).then(txt => {
        let fe = document.getElementById('full-css-editor');
        if(!fe) {
          fe = document.createElement('textarea');
          fe.id = 'full-css-editor';
          fe.rows = 10;
          fe.style.width = '100%';
          // append to your inspector container (attrDynamicList)
          if(attrDynamicList) attrDynamicList.appendChild(fe);
        }
        fe.value = txt;
      }).catch(() => {
        // ignore if not found
      });
      
      selectedElement = null;
      if(domTree) domTree.innerHTML = (mode === "load") ? "<div class='muted'>Loading...</div>" : "";
      clearAttrPanel();
      // hide parent overlay (safe)
      hideOverlay();
    }

    function closeModal(){
      if(modalWrap){
        modalWrap.classList.add("modal-hidden");
        modalWrap.style.display = "none";
      }
      if(previewCard) previewCard.classList.remove("fullscreen");
      if(iframe) iframe.src = "about:blank";
      if(domTree) domTree.innerHTML = "";
      clearAttrPanel();
      currentProject = null;
      currentMode = null;
      doc = null;
      selectedElement = null;
      hideOverlay();
    }

    if(closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if(modalOverlay) modalOverlay.addEventListener("click", (e) => { if(e.target === modalOverlay) closeModal(); });
    document.addEventListener("keydown", (e) => { if(e.key === "Escape" && (!modalWrap || !modalWrap.classList.contains("modal-hidden"))) closeModal(); });

    // ---------- Toggle UI controls ----------
    function toggleControls(enable){
      const controls = [addElementBtn, saveHtmlBtn, deleteBtn, moveUpBtn, moveDownBtn, applyAttrsBtn];
      controls.forEach(c => {
        if(!c) return;
        c.disabled = !enable;
        if(!enable) c.classList && c.classList.add('muted'); else c.classList && c.classList.remove('muted');
      });
      if(attrStatic.id) attrStatic.id.readOnly = !enable;
      if(attrStatic.class) attrStatic.class.readOnly = !enable;
      if(attrStatic.list) attrStatic.list.readOnly = !enable;
      if(attrStatic.inner) attrStatic.inner.readOnly = !enable;
    }

    // ---------- Iframe load handling ----------
    if (iframe) {
      iframe.addEventListener("load", () => {
        try {
          // If iframe is accessible (same-origin) we get its document
          if (currentMode === "load") {
            doc = iframe.contentDocument || iframe.contentWindow.document;
          
            // allow attachClickIntercept to reattach fresh handlers
            clickHandlerAttached = false;
          
            // rebuild DOM tree UI and attach click intercepts inside iframe
            buildTree();
            attachClickIntercept();
          
            // ensure UI panels are visible for edit/load mode
            if (domTree) domTree.style.display = "";
            if (attrDynamicList) attrDynamicList.style.display = "";
            if (previewCard) {
              previewCard.classList.remove("preview-only");
              previewCard.classList.add("fullscreen");
            }
          
            // set title textbox to document <title> (if available)
            try {
              if (titleTextBox && doc) {
                const t = doc.title ||
                          (doc.querySelector && (doc.querySelector("title") ? doc.querySelector("title").textContent : ""));
                titleTextBox.value = (t || "").trim();
              }
            } catch (e) {
              // ignore minor failures reading title
              console.warn("Reading title from iframe failed:", e);
            }
          
            // reset history for this loaded document and push initial snapshot
            try {
              history = [];
              historyPos = -1;
              pushHistorySnapshot();
            } catch (e) {
              console.warn("initial pushHistory failed on iframe load", e);
            }
          
          } else {
            // Preview mode (not editing) — hide editing panels and show preview-only UI
            if (domTree) domTree.style.display = "none";
            if (attrDynamicList) attrDynamicList.style.display = "none";
            if (previewCard) {
              previewCard.classList.remove("fullscreen");
              previewCard.classList.add("preview-only");
            }
            // try to keep doc reference if same-origin; otherwise ignore
            try {
              doc = iframe.contentDocument || iframe.contentWindow.document;
            } catch (e) {
              doc = null;
            }
          }
        
        } catch (e) {
          // Most common failure: cross-origin iframe (can't access document)
          console.error("Cannot access iframe document (maybe cross-origin):", e);
          doc = null;
        
          // show friendly message in DOM tree area and hide edit panels
          if (domTree) domTree.innerHTML = "<div class='muted'>Cannot access project (cross-origin?). Editing disabled.</div>";
          if (attrDynamicList) attrDynamicList.style.display = "none";
          if (previewCard) {
            previewCard.classList.remove("fullscreen");
            previewCard.classList.add("preview-only");
          }
        }
      });
    }


    // ---------- Tree builder (filters overlay nodes) ----------
    function buildTree(){
      if(!domTree) return;
      domTree.innerHTML = "";
      if(!doc) return;

      // reset mapping for this new tree build
      nodeToTreeNode = new WeakMap();

      const root = doc.body || doc.documentElement;
      const rootNode = createTreeNode(root, true);
      domTree.appendChild(rootNode);
    }


    function createTreeNode(node, isRoot = false){
      const el = document.createElement("div");
      el.className = "tree-node";
      const tag = node.tagName ? node.tagName.toLowerCase() : "#text";
      const idPart = node.id ? ` #${node.id}` : "";
      const classPart = node.className ? ` .${String(node.className).split(' ')[0]}` : "";
      el.textContent = `<${tag}>${idPart}${classPart}`;
      el.onclick = (ev) => {
        ev.stopPropagation();
        selectElement(node, el);
      };

      // children: skip overlay helper nodes
      const children = Array.from(node.children || []).filter(ch => !isOverlayNode(ch));
      if(children && children.length){
        const wrap = document.createElement("div");
        wrap.style.paddingLeft = isRoot ? "0px" : "12px";
        children.forEach(ch => wrap.appendChild(createTreeNode(ch)));
        el.appendChild(wrap);
      }
       // map iframe node -> tree node element for reliable lookup later
      try { nodeToTreeNode.set(node, el); } catch(e){ /* ignore */ }
      return el;
    }

    // ---------- select element ----------
    function selectElement(node, treeNodeEl){
      if(domTree) Array.from(domTree.querySelectorAll(".tree-node")).forEach(n => n.classList.remove("selected"));
      if(treeNodeEl) treeNodeEl.classList.add("selected");
      hideOverlay();
      selectedElement = node;
      if(currentMode === "load" && doc && selectedElement) showOverlayOn(selectedElement);
      fillAttrPanel(selectedElement);
    }

    // ---------- apply dynamic attrs ----------
    // ---------- apply dynamic attrs ----------
if(applyAttrsBtn){
  applyAttrsBtn.addEventListener("click", () => {
    if(currentMode !== "load") return alert("Editing is available only in Load mode");
    if(!selectedElement) return alert("Select an element first");

    try {
      if(attrDynamicList && attrDynamicList.children.length){
        const inputs = Array.from(attrDynamicList.querySelectorAll("input[data-attr-name]"));
        inputs.forEach(inp => {
          const name = inp.dataset.attrName;
          const val = (inp.value || "").trim();
          if(!name) return;
          if(name === "id") selectedElement.id = val;
          else if(name === "class") selectedElement.className = val;
          else {
            if(val === "") selectedElement.removeAttribute(name);
            else selectedElement.setAttribute(name, val);
          }
        });
        const innerTA = document.getElementById("attr-inner");
        if(innerTA) selectedElement.innerHTML = innerTA.value;
      } else {
        // static fallback
        if(!attrStatic.id) return;
        selectedElement.id = (attrStatic.id.value || "").trim();
        selectedElement.className = (attrStatic.class.value || "").trim();
        // remove non id/class attrs
        Array.from(selectedElement.attributes || []).forEach(a => {
          if(a.name !== "id" && a.name !== "class") selectedElement.removeAttribute(a.name);
        });
        const lines = (attrStatic.list.value || "").split("\n").map(l=>l.trim()).filter(Boolean);
        lines.forEach(line => {
          const idx = line.indexOf("=");
          if(idx>0) selectedElement.setAttribute(line.slice(0,idx).trim(), line.slice(idx+1).trim());
        });
        selectedElement.innerHTML = attrStatic.inner.value;
      }

      // ===== apply title-textbox value into the iframe document's <title> =====
      try {
        if(titleTextBox && typeof titleTextBox.value === "string" && doc) {
          const t = titleTextBox.value.trim();
          if(t) {
            let titleEl = doc.querySelector("title");
            if(!titleEl){
              titleEl = doc.createElement("title");
              (doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement).appendChild(titleEl);
            }
            titleEl.textContent = t;
          }
        }
      } catch(e){ console.warn("apply title on applyAttrs failed", e); }

      // ===== record snapshot so this Apply is undo-able =====
      try { pushHistorySnapshot(); } catch(e){ console.warn("pushHistory on apply failed", e); }

      // refresh UI
      buildTree();
      requestAnimationFrame(() => { if(selectedElement) showOverlayOn(selectedElement); });


    } catch(err){
      console.error("applyAttrs click handler failed:", err);
      alert("Apply failed");
    }
  });
}


    // ---------- upload handler ----------
    if(uploadBtn){
      uploadBtn.addEventListener("click", () => {
        const file = uploadInput && uploadInput.files && uploadInput.files[0];
        if(!file) return uploadStatus && (uploadStatus.textContent = "Choose a file first.");
        if(!currentProject) return uploadStatus && (uploadStatus.textContent = "No project loaded.");

        const target = (uploadTargetSelect && uploadTargetSelect.value) || "images";
        const form = new FormData();
        form.append("file", file);
        form.append("target", target);

        if(uploadStatus) uploadStatus.textContent = "Uploading...";
        fetch(`/api/projects/${encodeURIComponent(currentProject)}/upload`, {
          method: "POST",
          body: form
        }).then(r => r.json())
          .then(res => {
            if(res.ok && res.path){
              if(uploadStatus) uploadStatus.textContent = "Uploaded: " + res.path;
              const attrToFill = uploadArea && uploadArea.dataset ? uploadArea.dataset.attrToFill : null;
              if(attrToFill && attrDynamicList){
                const inp = Array.from(attrDynamicList.querySelectorAll("input[data-attr-name]"))
                  .find(i => i.dataset.attrName === attrToFill);
                if(inp) inp.value = res.path;
              } else if(attrStatic && attrStatic.list){
                attrStatic.list.value += `\n${attrToFill}=${res.path}`;
              }
            } else {
              if(uploadStatus) uploadStatus.textContent = "Upload failed: " + (res.error || "unknown");
            }
          }).catch(err => {
            console.error(err);
            if(uploadStatus) uploadStatus.textContent = "Upload error";
          });
      });
    }

    // ---------- attach click intercept inside iframe ----------
    function attachClickIntercept(){
      if(!doc || clickHandlerAttached) return;
      try {
        // click handler inside iframe (to select elements)
        doc.addEventListener("click", iframeClickHandler, true);
      
        // also attach keyboard handler inside iframe so shortcuts work while iframe focused
        try {
          if(typeof handleEditorKeydown === "function"){
            doc.addEventListener("keydown", handleEditorKeydown, true);
            // also attach to iframe window (some keys like Tab are better caught on window)
            if(doc.defaultView && typeof doc.defaultView.addEventListener === "function"){
              doc.defaultView.addEventListener("keydown", handleEditorKeydown, true);
            }
          }
        } catch(e){
          console.warn("attach keydown inside iframe failed", e);
        }
      
        clickHandlerAttached = true;
        attachIframeScrollHandlers();

      } catch(e){
        console.warn("attachClickIntercept failed", e);
      }
    }



    function iframeClickHandler(e){
      if(!e || !e.target) return;
      try { e.preventDefault(); e.stopPropagation(); } catch(_) {}
      // ignore if clicked an overlay inside iframe (shouldn't happen because we don't inject), but safe-check
      try {
        if(isOverlayNode(e.target)) return;
      } catch(_) {}
      const el = e.target;
      selectElement(el, findTreeNodeFor(el));
      return false;
    }

    function findTreeNodeFor(node){
      if(!domTree || !node) return null;
      try {
        // prefer the direct mapping (fast & reliable)
        const mapped = nodeToTreeNode.get(node);
        if(mapped) return mapped;
      } catch(e){ /* ignore */ }
    
      // fallback: label-based search (existing behavior)
      const label = `<${(node.tagName || "").toLowerCase()}>`;
      const list = Array.from(domTree.querySelectorAll(".tree-node"));
      for(let n of list) if(n.textContent && n.textContent.indexOf(label) === 0) return n;
      return list[0] || null;
    }


    // ---------- inline editing convenience ----------
    if(domTree){
      domTree.addEventListener("dblclick", (e) => {
        const treeNode = getNodeFromTreeEvent(e.target);
        if(!treeNode || !selectedElement) return;
        enableInlineEdit(selectedElement);
      });
    }

    function getNodeFromTreeEvent(target){
      let el = target;
      while(el && !el.classList.contains("tree-node")) el = el.parentElement;
      return el;
    }

    function enableInlineEdit(el){
      if(!doc || !el) return;
      try {
        el.contentEditable = "true";
        el.focus();
        const sel = el.ownerDocument.getSelection();
        if(sel){
          sel.removeAllRanges();
          const range = el.ownerDocument.createRange();
          range.selectNodeContents(el);
          sel.addRange(range);
        }
        el.addEventListener("blur", function onBlur(){
          el.contentEditable = "false";
          el.removeEventListener("blur", onBlur);
          fillAttrPanel(selectedElement);
          buildTree();
          showOverlayOn(el);
          try { pushHistorySnapshot(); } catch(e){ console.warn("pushHistory on inline edit failed", e); }
        });
      } catch(e){ console.error("inline edit failed", e); }
    }

    
    // ---------- keyboard shortcuts (load mode) ----------
    function handleEditorKeydown(e) {
      // only active in editing/load mode
      if (!currentMode || currentMode !== "load") return;

      const key = e.key;
      const code = e.code; // fallback if needed
      const meta = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // helper: is the user typing in an input-like context (parent or iframe)
      function isTypingContext() {
        try {
          // parent document focused element
          const parentActive = document.activeElement;
          const pTag = parentActive && parentActive.tagName ? parentActive.tagName.toLowerCase() : null;
          const parentTyping = pTag === "input" || pTag === "textarea" || (parentActive && parentActive.isContentEditable);
        
          if (parentTyping) return true;
        
          // if parent iframe has focus, check iframe's active element (if accessible)
          if (parentActive && (parentActive.tagName || "").toLowerCase() === "iframe" && doc) {
            const activeInIframe = doc.activeElement;
            const t = activeInIframe && activeInIframe.tagName ? activeInIframe.tagName.toLowerCase() : null;
            return t === "input" || t === "textarea" || (activeInIframe && activeInIframe.isContentEditable);
          }
        
          return false;
        } catch (err) {
          // if cross-origin or any error, be conservative and assume not typing
          return false;
        }
      }
    
      const typing = isTypingContext();
    
      // Short-circuit global combos that always apply (save, undo, close)
      if (meta && (key === "s" || key === "S")) { // Ctrl/Cmd + S -> Save
        e.preventDefault();
        if (saveHtmlBtn) saveHtmlBtn.click();
        return;
      }
      if (meta && (key === "z" || key === "Z")) { // Ctrl/Cmd + Z -> Undo
        e.preventDefault();
        restoreHistoryUndo();
        return;
      }
      if (key === "Escape") { // ESC -> Close modal
        e.preventDefault();
        closeModal();
        return;
      }
    
      // Keys that operate on a selected element — require selection (unless typing)
      const requiresSelection = ["Delete", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Home", "End", "PageUp", "PageDown"];
      if (requiresSelection.includes(key) && !selectedElement && !typing) {
        // nothing selected — ignore these
        return;
      }
    
      // Map of common actions (prefer calling internal functions; fallback to button clicks)
      // Map of common actions — call the centralized helpers directly (no fragile fallbacks)
      const actions = {
        save: () => { if (saveHtmlBtn) saveHtmlBtn.click(); },
        undo: () => { restoreHistoryUndo(); },
        close: () => { closeModal(); },
        del: () => { if (deleteBtn) deleteBtn.click(); },
        apply: () => { if (applyAttrsBtn) applyAttrsBtn.click(); },
      
        // CALL the centralized functions we added earlier
        moveUp: () => { 
          try { 
            console.debug("[editor] action: moveUp"); 
            if (typeof doMoveUp === "function") doMoveUp(); 
            else if (moveUpBtn) moveUpBtn.click(); 
          } catch(err){ console.warn("moveUp action failed", err); }
        },
      
        moveDown: () => { 
          try { 
            console.debug("[editor] action: moveDown"); 
            if (typeof doMoveDown === "function") doMoveDown(); 
            else if (moveDownBtn) moveDownBtn.click(); 
          } catch(err){ console.warn("moveDown action failed", err); }
        },
      
        indent: () => { 
          try { 
            console.debug("[editor] action: indent"); 
            if (typeof indentSelected === "function") indentSelected(); 
            else if (shiftBtn) shiftBtn.click(); 
          } catch(err){ console.warn("indent action failed", err); }
        },
      
        outdent: () => { 
          try { 
            console.debug("[editor] action: outdent"); 
            if (typeof outdentSelected === "function") outdentSelected(); 
            else if (unshiftBtn) unshiftBtn.click(); 
          } catch(err){ console.warn("outdent action failed", err); }
        },
      
        moveToFirstSibling: () => {
          if (!selectedElement) return;
          const parent = selectedElement.parentElement;
          if (!parent) return;
          parent.insertBefore(selectedElement, parent.firstElementChild);
          try { pushHistorySnapshot(); } catch (_) {}
          buildTree();
          const tn = (typeof nodeToTreeNode !== "undefined" && nodeToTreeNode.get) ? nodeToTreeNode.get(selectedElement) : findTreeNodeFor(selectedElement);
          if (tn) selectElement(selectedElement, tn);
          requestAnimationFrame(() => { if (selectedElement) try { showOverlayOn(selectedElement); } catch(_) {} });
        },
      
        moveToLastSibling: () => {
          if (!selectedElement) return;
          const parent = selectedElement.parentElement;
          if (!parent) return;
          parent.appendChild(selectedElement);
          try { pushHistorySnapshot(); } catch (_) {}
          buildTree();
          const tn = (typeof nodeToTreeNode !== "undefined" && nodeToTreeNode.get) ? nodeToTreeNode.get(selectedElement) : findTreeNodeFor(selectedElement);
          if (tn) selectElement(selectedElement, tn);
          requestAnimationFrame(() => { if (selectedElement) try { showOverlayOn(selectedElement); } catch(_) {} });
        }
      };

    
      // Handle deletion & apply (Enter) — do not intercept when typing
      if (key === "Delete" && !typing) {
        e.preventDefault();
        actions.del();
        return;
      }
      if (key === "Enter" && !typing) {
        e.preventDefault();
        actions.apply();
        return;
      }
    
      // Arrow keys behavior:
      // - ArrowUp / ArrowDown: move element up/down one sibling
      // - ArrowLeft: outdent (pull element out to be sibling of parent)
      // - ArrowRight: indent (move element to be child of previous sibling)
      // Modifiers:
      // - Shift + ArrowLeft/ArrowRight: same as ArrowLeft/Right (alternative)
      // - Ctrl + ArrowUp/ArrowDown: move to first/last sibling
      // - Alt + ArrowUp/ArrowDown: move up/down but keep focus (same as simple move)
      if (!typing && (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")) {
        e.preventDefault();
      
        // Up / Down
        if (key === "ArrowUp" || key === "ArrowDown") {
          if (meta) {
            // Ctrl + ArrowUp/Down => move to first/last sibling
            if (key === "ArrowUp") actions.moveToFirstSibling();
            else actions.moveToLastSibling();
          } else {
            // simple move up/down
            if (key === "ArrowUp") actions.moveUp();
            else actions.moveDown();
          }
          return;
        }
      
        // Left / Right -> Outdent / Indent
        if (key === "ArrowLeft" || key === "ArrowRight") {
          // treat Shift+Arrow same as Arrow with no meta
          if (key === "ArrowLeft") {
            actions.outdent();
          } else {
            actions.indent();
          }
          return;
        }
      }
    
      // Tab / Shift+Tab => indent/outdent (only when not typing)
      if (!typing && key === "Tab") {
        e.preventDefault();
        if (shift) actions.outdent();
        else actions.indent();
        return;
      }
    
      // Home/End page navigation for element: Ctrl+Home => move to first child of parent? We map:
      if (!typing && (key === "Home" || key === "End")) {
        e.preventDefault();
        if (key === "Home") actions.moveToFirstSibling();
        else actions.moveToLastSibling();
        return;
      }
    
      // Additional navigational shortcuts (PageUp / PageDown) map to move up/down
      if (!typing && (key === "PageUp" || key === "PageDown")) {
        e.preventDefault();
        if (key === "PageUp") actions.moveUp();
        else actions.moveDown();
        return;
      }
    
      // Formatting shortcuts with meta (when not typing)
      if (meta && !typing) {
        const lower = (key || "").toLowerCase();
        if (lower === "b") {
          e.preventDefault();
          try { if (doc) doc.execCommand("bold"); } catch (_) {}
          return;
        }
        if (lower === "i") {
          e.preventDefault();
          try { if (doc) doc.execCommand("italic"); } catch (_) {}
          return;
        }
        if (lower === "k") {
          e.preventDefault();
          if (!doc) return;
          const url = prompt("Enter URL for link:");
          if (url) {
            try { doc.execCommand("createLink", false, url); } catch (_) {}
          }
          return;
        }
      }
    
      // If we reach here — no handled shortcut
    }



    // attach to parent document (so shortcuts work when parent has focus)
    document.addEventListener("keydown", handleEditorKeydown, true);



    // ---------- Save HTML to server (overlay is in parent so not included) ----------
    // ---------- Save HTML to server (format + ensure scripts last) ----------
    // ---------- Save HTML (robust DOM-based serializer) ----------
    if (saveHtmlBtn) {
      saveHtmlBtn.addEventListener("click", async () => {
        if (currentMode !== "load") return alert("Save available only in Load mode");
        if (!currentProject || !doc) return alert("No project to save");
      
        try {
          // apply title textbox into iframe before serializing
          try {
            if (titleTextBox && typeof titleTextBox.value === "string") {
              const t = titleTextBox.value.trim();
              if (t) {
                let titleEl = doc.querySelector("title");
                if (!titleEl) {
                  titleEl = doc.createElement("title");
                  (doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement).appendChild(titleEl);
                }
                titleEl.textContent = t;
              }
            }
          } catch (e) {
            console.warn("apply title before save failed", e);
          }
        
          // remove editor overlays if accidentally injected
          try {
            try {
              const ov1 = doc.getElementById("__editor_highlight_overlay");
              if(ov1) ov1.remove();
            } catch(_) {}
            try {
              // our parent overlay id variant
              const ov2 = doc.getElementById("__editor_highlight_overlay_parent");
              if(ov2) ov2.remove();
            } catch(_) {}

          } catch (_) {}
        
          // collect all <script> tags (preserve)
          const scriptEls = Array.from(doc.querySelectorAll("script"));
          // remove scripts from the DOM clones to avoid duplication
          const headClone = doc.head ? doc.head.cloneNode(true) : null;
          if (headClone) Array.from(headClone.querySelectorAll("script")).forEach(s=>s.remove());
          const bodyClone = doc.body ? doc.body.cloneNode(true) : null;
          if (bodyClone) Array.from(bodyClone.querySelectorAll("script")).forEach(s=>s.remove());
        
          // build doctype
          let doctype = "<!DOCTYPE html>";
          try {
            if (doc.doctype) {
              const dt = doc.doctype;
              doctype = `<!DOCTYPE ${dt.name}${dt.publicId ? ` PUBLIC "${dt.publicId}"` : ""}${dt.systemId ? ` "${dt.systemId}"` : ""}>`;
            }
          } catch (e) {}
        
          // html attributes
          const htmlEl = doc.documentElement;
          const htmlAttrs = htmlEl && htmlEl.getAttributeNames ? htmlEl.getAttributeNames().map(n => {
            const v = htmlEl.getAttribute(n);
            return `${n}="${String(v).replace(/"/g,'&quot;')}"`;
          }).join(" ") : "";
        
          const headInner = headClone ? headClone.innerHTML.trim() : "";
          const bodyInner = bodyClone ? bodyClone.innerHTML.trim() : "";
        
          // append scripts at end of body
          const scriptsHtml = scriptEls.map(s => s.outerHTML).join("\n");
        
          const finalHtml = [
            doctype,
            `<html ${htmlAttrs}>`,
            `<head>`,
            headInner,
            `</head>`,
            `<body${doc.body && doc.body.hasAttribute && doc.body.hasAttribute('contenteditable') ? ` contenteditable="${doc.body.getAttribute('contenteditable')}"` : ''}>`,
            bodyInner,
            scriptsHtml ? `\n\n${scriptsHtml}\n` : "",
            `</body>`,
            `</html>`
          ].join("\n");
        
          // optional pretty print
          let pretty = finalHtml;
          try { if (typeof prettyPrintHtml === "function") pretty = prettyPrintHtml(pretty); } catch(e){}
        
          // send to server
          const res = await fetch(`/api/projects/${encodeURIComponent(currentProject)}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ html: pretty })
          });
          const json = await res.json();
          if (json && json.ok) alert("Saved");
          else alert("Save failed");
        } catch (err) {
          console.error("Failed to save project:", err);
          alert("Save failed");
        }
      });
    }



    // ---------- Add element (supports input+datalist OR select) ----------
    // ---------- Add element (respect script-last rule) ----------
    if(addElementBtn){
      addElementBtn.addEventListener("click", () => {
        if(currentMode !== "load") return alert("Adding elements is available only in Load mode");
        let raw = "";
        try { raw = (newTagSelect && newTagSelect.value) ? newTagSelect.value : ""; } catch(e){ raw = ""; }
        const safeTag = raw ? String(raw).trim().toLowerCase() : "div";
        if(!doc) return;
        let el;
        try { el = doc.createElement(safeTag); } catch(e) { el = doc.createElement("div"); }
        if(safeTag === "img") el.setAttribute("src", "");
        if(safeTag === "a") { el.setAttribute("href", "#"); el.textContent = "link"; }
        const where = selectedElement || (doc.body || doc.documentElement);
        try {
          // if parent has script children, insert before first script so scripts remain last
          const firstScript = (where.querySelector) ? where.querySelector("script") : null;
          if(firstScript) where.insertBefore(el, firstScript);
          else where.appendChild(el);
        } catch(e){
          (doc.body || doc.documentElement).appendChild(el);
        }
        pushHistorySnapshot();
        buildTree();
      });
    }


    // ---------- Delete / Move up / Move down ----------
    if(deleteBtn){
      deleteBtn.addEventListener("click", () => {
        if(currentMode !== "load") return alert("Editing is available only in Load mode");
        if(!selectedElement) return alert("No element selected");
        if(!confirm("Delete selected element?")) return;
        selectedElement.remove();
      
        try { pushHistorySnapshot(); } catch(e){ console.warn("pushHistory on delete failed", e); }
      
        selectedElement = null;
        clearAttrPanel();
        buildTree();
        hideOverlay();
      });
    }
    // centralized move helpers (use these from both buttons and keyboard)
    // ---------- unified move function (up/down + edge) ----------
    // === index-based, robust moveSelected (use this to replace your current implementation) ===
const MOVE_DEBUG = false; // true => prints debug logs

function moveSelected({ reverse = false, toEdge = null, steps = 1 } = {}) {
  // reverse=false => move UP (toward index 0)
  // reverse=true  => move DOWN (toward larger indexes)
  if (!selectedElement || !doc) {
    if (MOVE_DEBUG) console.debug("[moveSelected] no selection/doc");
    return;
  }

  try {
    const selTag = (selectedElement.tagName || "").toLowerCase();
    if (selTag === "script") {
      if (MOVE_DEBUG) console.debug("[moveSelected] selected is <script> — skipping");
      return;
    }

    const parent = selectedElement.parentElement;
    if (!parent) {
      if (MOVE_DEBUG) console.debug("[moveSelected] no parent");
      return;
    }

    // helper overlay check (reuse existing function if present)
    const overlayCheck = (typeof isOverlayNode === "function")
      ? isOverlayNode
      : (n => Boolean(n && n.id && String(n.id).includes("editor_highlight_overlay")));

    // build ordered array of children we can move between (exclude <script> and overlays)
    const allChildren = Array.from(parent.children || []);
    const movableChildren = allChildren.filter(ch => {
      if (!ch || !ch.tagName) return false;
      const t = (ch.tagName || "").toLowerCase();
      if (t === "script") return false;
      if (overlayCheck(ch)) return false;
      return true;
    });

    if (MOVE_DEBUG) {
      console.debug("[moveSelected] movableChildren:", movableChildren.map(c => c.tagName + (c.id ? "#" + c.id : "")));
    }

    // find index of selected in movableChildren
    let idx = movableChildren.indexOf(selectedElement);

    // if not found, fall back to filtered index among allChildren (safer)
    if (idx === -1) {
      const filtered = allChildren.filter(c => c && c.tagName && (String(c.tagName).toLowerCase() !== "script") && !overlayCheck(c));
      idx = filtered.indexOf(selectedElement);
      if (idx !== -1) {
        // use filtered as the base list
        if (MOVE_DEBUG) console.debug("[moveSelected] using filtered fallback list");
        // replace movableChildren with filtered so indices match
        movableChildren.length = 0;
        Array.prototype.push.apply(movableChildren, filtered);
      }
    }

    // if still not found, do safe naive fallback and exit
    if (idx === -1) {
      if (MOVE_DEBUG) console.debug("[moveSelected] selected not in parent's element children — doing naive fallback");
      if (toEdge === "first") {
        const firstNonScript = allChildren.find(c => (c.tagName || "").toLowerCase() !== "script" && !overlayCheck(c));
        if (firstNonScript && firstNonScript !== selectedElement) parent.insertBefore(selectedElement, firstNonScript);
      } else if (toEdge === "last") {
        const firstScript = parent.querySelector ? parent.querySelector("script") : null;
        if (firstScript) parent.insertBefore(selectedElement, firstScript);
        else parent.appendChild(selectedElement);
      } else if (!reverse) {
        const prev = selectedElement.previousElementSibling;
        if (prev) parent.insertBefore(selectedElement, prev);
      } else {
        const next = selectedElement.nextElementSibling;
        if (next) {
          const after = next.nextElementSibling;
          if (after) parent.insertBefore(selectedElement, after);
          else parent.appendChild(selectedElement);
        }
      }
      try { if (typeof pushHistorySnapshot === "function") pushHistorySnapshot(); } catch(_) {}
      if (typeof buildTree === "function") buildTree();
      requestAnimationFrame(() => { try { if (selectedElement) showOverlayOn(selectedElement); } catch(_) { hideOverlay(); } });
      return;
    }

    // compute target index
    let targetIndex;
    if (toEdge === "first") targetIndex = 0;
    else if (toEdge === "last") targetIndex = movableChildren.length - 1;
    else {
      const stepCount = Math.max(1, Math.floor(steps || 1));
      targetIndex = idx + (reverse ? stepCount : -stepCount);
      targetIndex = Math.max(0, Math.min(movableChildren.length - 1, targetIndex));
    }

    if (MOVE_DEBUG) console.debug("[moveSelected] idx:", idx, "targetIndex:", targetIndex);

    // nothing to do
    if (targetIndex === idx) {
      if (MOVE_DEBUG) console.debug("[moveSelected] already at target index");
      return;
    }

    // perform robust insertion:
    // - if inserting before an existing movable child, insert before it
    // - if inserting at the end, insert before the first <script> if present, otherwise append
    const firstScript = parent.querySelector ? parent.querySelector("script") : null;

    if (targetIndex < movableChildren.length) {
      // If moving down (targetIndex > idx) insert after the reference node,
      // otherwise insert before it. Using ref.nextSibling works for both.
      let refNode = movableChildren[targetIndex];
      if (targetIndex > idx) refNode = refNode.nextSibling;
      parent.insertBefore(selectedElement, refNode);
    } else {
      // target index would be after last movable child: place before first script if present
      if (firstScript) parent.insertBefore(selectedElement, firstScript);
      else parent.appendChild(selectedElement);
    }


    // defensive: ensure scripts remain last — if selected ended up after a script, move it before that script
    try {
      if (firstScript && (firstScript.compareDocumentPosition(selectedElement) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        parent.insertBefore(selectedElement, firstScript);
      }
    } catch (e) { /* ignore */ }

    // push history + rebuild tree + reselect + overlay
    try { if (typeof pushHistorySnapshot === "function") pushHistorySnapshot(); } catch(_) {}
    if (typeof buildTree === "function") buildTree();

    try {
      const tn = (typeof nodeToTreeNode !== "undefined" && nodeToTreeNode.get) ? nodeToTreeNode.get(selectedElement) : findTreeNodeFor(selectedElement);
      if (tn) selectElement(selectedElement, tn);
      else { selectedElement = null; if (typeof clearAttrPanel === "function") clearAttrPanel(); if (typeof hideOverlay === "function") hideOverlay(); }
    } catch(e) { /* ignore */ }

    requestAnimationFrame(() => { try { if (selectedElement) showOverlayOn(selectedElement); } catch(_) { hideOverlay(); } });

    if (MOVE_DEBUG) console.debug("[moveSelected] moved OK", { idx, targetIndex });
  } catch (err) {
    console.error("[moveSelected] unexpected error:", err);
  }
}



    if (moveUpBtn)    moveUpBtn.addEventListener("click", (e) => { e.preventDefault(); moveSelected({ reverse: false }); });
    if (moveDownBtn)  moveDownBtn.addEventListener("click", (e) => { e.preventDefault(); moveSelected({ reverse: true }); });



        // ---------- indent (shift) & outdent (unshift) ----------
    const shiftBtn = document.getElementById("shift");
    const unshiftBtn = document.getElementById("unshif"); // note: spelled 'unshif' in markup

    function indentSelected() {
      if(currentMode !== "load") return alert("Editing is available only in Load mode");
      if(!selectedElement) return alert("No element selected");
      const prev = selectedElement.previousElementSibling;
      if(!prev) return alert("No previous sibling to indent into");
      if(prev.tagName && prev.tagName.toLowerCase() === "script") return alert("Cannot indent into a script element");
      try {
        prev.appendChild(selectedElement);
        try { pushHistorySnapshot(); } catch(_) {}
        buildTree();
        const tn = (typeof nodeToTreeNode !== "undefined" && nodeToTreeNode.get) ? nodeToTreeNode.get(selectedElement) : findTreeNodeFor(selectedElement);
        if(tn) selectElement(selectedElement, tn);
        else { selectedElement = null; clearAttrPanel(); hideOverlay(); }
        requestAnimationFrame(() => { if(selectedElement) showOverlayOn(selectedElement); });
      } catch(e){ console.error("indent failed", e); }
    }

    function outdentSelected() {
      if(currentMode !== "load") return alert("Editing is available only in Load mode");
      if(!selectedElement) return alert("No element selected");
      const parent = selectedElement.parentElement;
      if(!parent || parent === (doc.body || doc.documentElement)) return alert("Cannot outdent further");
      try {
        const gp = parent.parentElement;
        if(!gp) return;
        if(parent.nextElementSibling) gp.insertBefore(selectedElement, parent.nextElementSibling);
        else gp.appendChild(selectedElement);
        try { pushHistorySnapshot(); } catch(_) {}
        buildTree();
        const tn = (typeof nodeToTreeNode !== "undefined" && nodeToTreeNode.get) ? nodeToTreeNode.get(selectedElement) : findTreeNodeFor(selectedElement);
        if(tn) selectElement(selectedElement, tn);
        else { selectedElement = null; clearAttrPanel(); hideOverlay(); }
        requestAnimationFrame(() => { if(selectedElement) showOverlayOn(selectedElement); });
      } catch(e){ console.error("outdent failed", e); }
    }



    if(shiftBtn) shiftBtn.addEventListener("click", indentSelected);
    if(unshiftBtn) unshiftBtn.addEventListener("click", outdentSelected);

    // ---------- helpers ----------
    function findClosestTreeNodeLabel(node){
      return `<${(node && node.tagName) ? node.tagName.toLowerCase() : "#text"}>`;
    }

    // small external API
    window.__editor_internal = {
      setModeAndProject: (mode, project) => { currentMode = mode; currentProject = project; },
      openModal: openModal,
      closeModal: closeModal
    };

    // End of DOMContentLoaded callback
  });

})(); // IIFE end
