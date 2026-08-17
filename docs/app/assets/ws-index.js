(function () {
  "use strict";

  var PREVIEWABLE_DIRECT = ["png", "jpg", "jpeg", "gif", "svg", "webp", "pdf", "txt"];
  var PREVIEWABLE_MD = ["md", "markdown"];
  var VIEWER_TYPES = ["pptx", "pptm"];

  var CATS = [
    { key: "ppt", label: "PPT" },
    { key: "md", label: "Markdown" },
    { key: "html", label: "HTML" },
    { key: "img", label: "图片" },
    { key: "pdf", label: "PDF" },
    { key: "text", label: "文本" },
    { key: "other", label: "其他" }
  ];

  var BADGE_COLOR = {
    ppt: "#E67E22",
    md: "#2A9D8F",
    html: "#3B82C4",
    img: "#2E9E5B",
    pdf: "#D0453E",
    text: "#5F7A92",
    other: "#55647A"
  };

  function extOf(name) {
    var i = name.lastIndexOf(".");
    return i === -1 ? "" : name.slice(i + 1).toLowerCase();
  }

  function catOf(name) {
    var ext = extOf(name);
    if (VIEWER_TYPES.indexOf(ext) !== -1) return "ppt";
    if (PREVIEWABLE_MD.indexOf(ext) !== -1) return "md";
    if (ext === "html" || ext === "htm") return "html";
    if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].indexOf(ext) !== -1) return "img";
    if (ext === "pdf") return "pdf";
    if (["txt", "csv", "json", "yml", "yaml", "xml", "log"].indexOf(ext) !== -1) return "text";
    return "other";
  }

  function badgeInfo(name) {
    var cat = catOf(name);
    var i = name.lastIndexOf(".");
    if (cat === "other") {
      if (i === -1 || i === name.length - 1) return { text: "\uFF0B", color: BADGE_COLOR.other };
      return { text: extOf(name).slice(0, 4).toUpperCase() || "+\uFF0B", color: BADGE_COLOR.other };
    }
    var labelMap = { ppt: "PPT", md: "MD", html: "HTML", img: "IMG", pdf: "PDF", text: "TXT" };
    return { text: labelMap[cat] || "\uFF0B", color: BADGE_COLOR[cat] };
  }

  function previewKind(name) {
    var cat = catOf(name);
    if (cat === "ppt") return "viewer";
    if (cat === "md") return "md";
    if (cat === "html") return "direct";
    if (cat === "img" || cat === "pdf" || cat === "text") return "direct";
    return null;
  }

  function encodePath(path) {
    return path
      .split("/")
      .map(function (s) {
        return encodeURIComponent(s);
      })
      .join("/");
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes())
    );
  }

  function mkEl(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  var FOLDER_SVG =
    '<span class="ws-folder" aria-hidden="true"><svg viewBox="0 0 24 20" width="21" height="17">' +
    '<path d="M2 5a2 2 0 0 1 2-2h5l2.2 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="currentColor"/></svg></span>';

  var ICON_EYE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

  var ICON_DOWNLOAD =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  // ============ 数据 ============

  var tree = [];
  var files = []; // 扁平列表 {name,path,size,modified,cat}

  function flatten(nodes, basePath) {
    var out = [];
    nodes.forEach(function (node) {
      var path = basePath ? basePath + "/" + node.name : node.name;
      if (node.type === "dir") {
        out = out.concat(flatten(node.children || [], path));
      } else {
        out.push({ name: node.name, path: path, size: node.size, modified: node.modified, cat: catOf(node.name) });
      }
    });
    return out;
  }

  // ============ 状态 ============

  var state = { view: "all", q: "", types: {}, sort: "name", dir: 1 };

  function fileMatches(f) {
    if (state.q) {
      if (f.name.toLowerCase().indexOf(state.q) === -1) return false;
    }
    var keys = Object.keys(state.types);
    if (keys.length && keys.indexOf(f.cat) === -1) return false;
    return true;
  }

  function sortVal(f) {
    if (state.sort === "size") return f.size;
    if (state.sort === "time") return new Date(f.modified).getTime() || 0;
    return f.name.toLowerCase();
  }

  function compare(a, b) {
    var va = sortVal(a);
    var vb = sortVal(b);
    var r;
    if (state.sort === "name") {
      r = String(va).localeCompare(String(vb), "zh-Hans-CN");
    } else {
      r = va < vb ? -1 : va > vb ? 1 : String(a.name).localeCompare(String(b.name), "zh-Hans-CN");
    }
    return r * state.dir;
  }

  function sortedList(list) {
    return list.slice().sort(compare);
  }

  // ============ 行与操作 ============

  function buildRow(fileEl) {
    var row = mkEl("div", "ws-file");

    var badge = mkEl("span", "ws-badge", badgeInfo(fileEl.name).text);
    badge.style.background = badgeInfo(fileEl.name).color;
    badge.title = fileEl.name;

    var name = mkEl("span", "ws-name", fileEl.name);
    name.title = fileEl.path;

    var meta = mkEl("span", "ws-meta");
    meta.appendChild(mkEl("span", "", formatSize(fileEl.size)));
    meta.appendChild(mkEl("span", "", formatDate(fileEl.modified)));

    var acts = mkEl("div", "ws-acts");

    var kind = previewKind(fileEl.name);
    if (kind) {
      var preview = mkEl("a", "ws-link preview icon");
      preview.innerHTML = ICON_EYE;
      preview.setAttribute("aria-label", "在线预览");
      preview.title = "在线预览";
      preview.href =
        kind === "viewer"
          ? "./viewer.html?doc=" + encodePath(fileEl.path)
          : kind === "md"
          ? "./mdpreview.html?doc=" + encodePath(fileEl.path)
          : "../" + encodePath(fileEl.path);
      preview.target = "_blank";
      preview.rel = "noopener";
      acts.appendChild(preview);
    }

    var dl = mkEl("a", "ws-link dl icon");
    dl.innerHTML = ICON_DOWNLOAD;
    dl.setAttribute("aria-label", "下载");
    dl.title = "下载";
    dl.href = "../" + encodePath(fileEl.path);
    dl.setAttribute("download", fileEl.name);
    acts.appendChild(dl);

    row.appendChild(badge);
    row.appendChild(name);
    row.appendChild(meta);
    row.appendChild(acts);
    return row;
  }

  // ============ 视图渲染 ============

  function renderAll() {
    var list = sortedList(files.filter(fileMatches));
    var wrap = mkEl("div", "ws-list");
    list.forEach(function (f) {
      var row = buildRow(f);
      if (state.q) row.classList.add("hit");
      wrap.appendChild(row);
    });
    return wrap;
  }

  function renderType() {
    var list = sortedList(files.filter(fileMatches));
    var wrap = mkEl("div", "ws-types");
    CATS.forEach(function (cat) {
      var arr = list.filter(function (f) {
        return f.cat === cat.key;
      });
      if (!arr.length) return;
      var sec = mkEl("section", "ws-type");
      var head = mkEl("div", "ws-type-hd");
      var dot = mkEl("span", "ws-cat-dot");
      dot.style.background = BADGE_COLOR[cat.key];
      head.appendChild(dot);
      head.appendChild(mkEl("span", "ws-type-name", cat.label));
      head.appendChild(mkEl("span", "ws-type-count", String(arr.length)));
      sec.appendChild(head);
      var listEl = mkEl("div", "ws-list");
      arr.forEach(function (f) {
        listEl.appendChild(buildRow(f));
      });
      sec.appendChild(listEl);
      wrap.appendChild(sec);
    });
    return wrap;
  }

  function usedCats(order, from) {
    var set = {};
    order.forEach(function (f) {
      set[f.cat] = true;
    });
    return CATS.filter(function (c) {
      return set[c.key];
    });
  }

  function pruneTree(node, basePath) {
    var kept = [];
    (node.children || []).forEach(function (kid) {
      var path = basePath ? basePath + "/" + kid.name : kid.name;
      if (kid.type === "dir") {
        var kids = pruneTree(kid, path);
        if (kids.length) kept.push({ type: "dir", name: kid.name, children: kids });
      } else {
        var f = { name: kid.name, path: path, size: kid.size, modified: kid.modified, cat: catOf(kid.name) };
        if (fileMatches(f)) kept.push({ type: "file", file: f });
      }
    });
    return sortTreeEntries(kept);
  }

  function sortTreeEntries(entries) {
    var dirs = entries.filter(function (e) {
      return e.type === "dir";
    });
    var fls = entries.filter(function (e) {
      return e.type !== "dir";
    }).map(function (e) {
      return e.file;
    });
    dirs.sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name), "zh-Hans-CN") * state.dir;
    });
    var sortedFls = sortedList(fls);
    var out = [];
    dirs.forEach(function (d) {
      out.push({ type: "dir", name: d.name, children: d.children });
    });
    sortedFls.forEach(function (f) {
      out.push({ type: "file", file: f });
    });
    return out;
  }

  function buildNode(entry, basePath) {
    var li = document.createElement("li");

    if (entry.type === "dir") {
      li.className = "ws-dir-node";
      var path = basePath ? basePath + "/" + entry.name : entry.name;
      var dir = mkEl("div", "ws-dir");
      dir.title = path;
      var chev = mkEl("span", "ws-chev", "\u203A");
      var ico = mkEl("span", "ws-ico");
      ico.innerHTML = FOLDER_SVG;
      var name = mkEl("span", "ws-name ws-name-dir", entry.name);
      dir.appendChild(chev);
      dir.appendChild(ico);
      dir.appendChild(name);

      if (state.q) dir.classList.add("open");

      li.appendChild(dir);
      if (entry.children.length) {
        var kidsWrap = mkEl("div", "ws-kids");
        var ul = mkEl("ul", "ws-tree");
        ul.style.setProperty("--depth", 0);
        entry.children.forEach(function (child) {
          var cli = buildNode(child, path);
          if (cli) ul.appendChild(cli);
        });
        kidsWrap.appendChild(ul);
        li.appendChild(kidsWrap);
        if (!state.q) {
          dir.addEventListener("click", function () {
            dir.classList.toggle("open");
          });
        }
      }
      return li;
    } else {
      li.className = "ws-file-node";
      var row = buildRow(entry.file);
      if (state.q) row.classList.add("hit");
      li.appendChild(row);
      return li;
    }
  }

  function renderTree() {
    var wrap = mkEl("div", "ws-tree-wrap");
    var entries = pruneTree({ children: tree }, "");
    if (!entries.length) return wrap;
    var ul = mkEl("ul", "ws-tree");
    ul.style.setProperty("--depth", 0);
    entries.forEach(function (entry) {
      var li = buildNode(entry, "");
      if (li) ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  // ============ 渲染入口 ============

  function render() {
    var content = document.getElementById("wsContent");
    content.innerHTML = "";

    var el;
    if (state.view === "tree") {
      el = renderTree();
    } else if (state.view === "type") {
      el = renderType();
    } else {
      el = renderAll();
    }

    if (!el || !el.hasChildNodes()) {
      document.getElementById("wsEmpty").hidden = false;
    } else {
      document.getElementById("wsEmpty").hidden = true;
      content.appendChild(el);
    }
  }

  // ============ 控件 ============

  function buildChips() {
    var chipBox = document.getElementById("wsChips");
    chipBox.innerHTML = "";
    var present = usedCats(files, {});
    present.forEach(function (cat) {
      var chip = mkEl("button", "ws-chip", cat.label);
      chip.dataset.cat = cat.key;
      chip.title = cat.label;
      chip.addEventListener("click", function () {
        var key = cat.key;
        if (state.types[key]) delete state.types[key];
        else state.types[key] = true;
        chip.classList.toggle("active", !!state.types[key]);
        render();
      });
      chipBox.appendChild(chip);
    });
  }

  function wireControls() {
    var views = Array.prototype.slice.call(document.querySelectorAll(".ws-view"));
    views.forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.view = btn.dataset.view;
        views.forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        render();
      });
    });

    var search = document.getElementById("wsSearch");
    search.addEventListener("input", function () {
      state.q = search.value.trim().toLowerCase();
      render();
    });

    var sortBtn = document.getElementById("wsSortBtn");
    var order = ["name", "size", "time"];
    var labels = { name: "名称", size: "大小", time: "修改时间" };
    sortBtn.addEventListener("click", function () {
      var i = order.indexOf(state.sort);
      state.sort = order[(i + 1) % order.length];
      sortBtn.textContent = labels[state.sort];
      render();
    });

    var dirBtn = document.getElementById("wsDir");
    dirBtn.addEventListener("click", function () {
      state.dir *= -1;
      dirBtn.textContent = state.dir === 1 ? "↑" : "↓";
      render();
    });
  }

  // ============ 启动 ============

  function showError(err) {
    var content = document.getElementById("wsContent");
    content.innerHTML = "";
    content.appendChild(mkEl("p", "ws-empty", "无法加载文件清单（" + (err || "未知错误") + "）。请先运行 scripts/generate-manifest.mjs 生成 manifest.json。"));
  }

  fetch("./manifest.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (manifest) {
      tree = manifest.tree || [];
      files = flatten(tree, "");
      if (!files.length) {
        document.getElementById("wsEmpty").hidden = false;
        return;
      }
      buildChips();
      wireControls();
      render();
    })
    .catch(function (err) {
      showError(err && err.message);
    });
})();