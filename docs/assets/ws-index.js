(function () {
  "use strict";

  var PREVIEWABLE_DIRECT = ["png", "jpg", "jpeg", "gif", "svg", "webp", "pdf", "txt"];
  var PREVIEWABLE_MD = ["md", "markdown"];
  var VIEWER_TYPES = ["pptx", "pptm"];

  function extOf(name) {
    var i = name.lastIndexOf(".");
    return i === -1 ? "" : name.slice(i + 1).toLowerCase();
  }

  function previewKind(name) {
    var ext = extOf(name);
    if (VIEWER_TYPES.indexOf(ext) !== -1) return "viewer";
    if (ext === "html" || ext === "htm") return "direct";
    if (PREVIEWABLE_DIRECT.indexOf(ext) !== -1) return "direct";
    if (PREVIEWABLE_MD.indexOf(ext) !== -1) return "md";
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

  var BADGE_COLOR = {
    ppt: "#E67E22",
    html: "#3B82C4",
    img: "#2E9E5B",
    pdf: "#D0453E",
    md: "#2A9D8F",
    txt: "#5F7A92",
    other: "#55647A"
  };

  function badgeInfo(name) {
    var i = name.lastIndexOf(".");
    if (i === -1 || i === name.length - 1) {
      return { text: "\uFF0B", color: BADGE_COLOR.other };
    }
    var ext = name.slice(i + 1).toLowerCase();
    if (ext === "pptx" || ext === "pptm") return { text: "PPT", color: BADGE_COLOR.ppt };
    if (ext === "html" || ext === "htm") return { text: "HTML", color: BADGE_COLOR.html };
    if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].indexOf(ext) !== -1)
      return { text: "IMG", color: BADGE_COLOR.img };
    if (ext === "pdf") return { text: "PDF", color: BADGE_COLOR.pdf };
    if (ext === "md") return { text: "MD", color: BADGE_COLOR.md };
    if (["txt", "csv", "json", "yml", "yaml", "xml", "log"].indexOf(ext) !== -1)
      return { text: "TXT", color: BADGE_COLOR.txt };
    return { text: ext.slice(0, 4).toUpperCase(), color: BADGE_COLOR.other };
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

  function mkEl(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function buildRow(fileRow, path) {
    var row = mkEl("div", "ws-file");

    var badge = mkEl("span", "ws-badge", badgeInfo(fileRow.name).text);
    badge.style.background = badgeInfo(fileRow.name).color;
    badge.title = fileRow.name;

    var name = mkEl("span", "ws-name", fileRow.name);
    name.title = path;

    var meta = mkEl("span", "ws-meta");
    var sizeSpan = mkEl("span", "", formatSize(fileRow.size));
    var dateSpan = mkEl("span", "", formatDate(fileRow.modified));
    meta.appendChild(sizeSpan);
    meta.appendChild(dateSpan);

    var acts = mkEl("div", "ws-acts");

    var kind = previewKind(fileRow.name);
    if (kind) {
      var preview = mkEl("a", "ws-link preview icon");
      preview.innerHTML = ICON_EYE;
      preview.setAttribute("aria-label", "在线预览");
      preview.title = "在线预览";
      preview.href =
        kind === "viewer"
          ? "./viewer.html?doc=" + encodePath(path)
          : kind === "md"
          ? "./mdpreview.html?doc=" + encodePath(path)
          : "./" + encodePath(path);
      preview.target = "_blank";
      preview.rel = "noopener";
      acts.appendChild(preview);
    }

    var dl = mkEl("a", "ws-link dl icon");
    dl.innerHTML = ICON_DOWNLOAD;
    dl.setAttribute("aria-label", "下载");
    dl.title = "下载";
    dl.href = "./" + encodePath(path);
    dl.setAttribute("download", fileRow.name);
    acts.appendChild(dl);

    row.appendChild(badge);
    row.appendChild(name);
    row.appendChild(meta);
    row.appendChild(acts);
    return row;
  }

  function buildTree(container, nodes, basePath, depth) {
    var ul = mkEl("ul", "ws-tree");
    ul.style.setProperty("--depth", depth);

    nodes.forEach(function (node) {
      var path = basePath ? basePath + "/" + node.name : node.name;
      var li = document.createElement("li");
      li.className = node.type === "dir" ? "ws-dir-node" : "ws-file-node";

      if (node.type === "dir") {
        var dir = mkEl("div", "ws-dir");
        dir.title = path;
        var chev = mkEl("span", "ws-chev", "\u203A");
        var ico = mkEl("span", "ws-ico");
        ico.innerHTML = FOLDER_SVG;
        var name = mkEl("span", "ws-name ws-name-dir", node.name);
        var cnt = mkEl("span", "ws-meta", String(node.children.length) + " 项");
        dir.appendChild(chev);
        dir.appendChild(ico);
        dir.appendChild(name);
        dir.appendChild(cnt);

        var kidsWrap = mkEl("div", "ws-kids");
        buildTree(kidsWrap, node.children, path, depth + 1);

        dir.addEventListener("click", function () {
          dir.classList.toggle("open");
        });

        li.appendChild(dir);
        li.appendChild(kidsWrap);
      } else {
        li.appendChild(buildRow(node, path));
      }

      ul.appendChild(li);
    });

    container.appendChild(ul);
  }

  function render(manifest) {
    var root = document.getElementById("wsTree");
    root.innerHTML = "";
    var tree = manifest.tree || [];
    if (!tree.length) {
      document.getElementById("wsEmpty").hidden = false;
      return;
    }
    buildTree(root, tree, "", 0);
  }

  function showError(err) {
    var root = document.getElementById("wsTree");
    root.innerHTML = "";
    var p = mkEl("p", "ws-empty", "无法加载文件清单（" + (err || "未知错误") + "）。请先运行 scripts/generate-manifest.mjs 生成 manifest.json。");
    root.appendChild(p);
  }

  fetch("./manifest.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      showError(err && err.message);
    });
})();