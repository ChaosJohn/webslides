(function () {
  "use strict";

  var PREVIEWABLE_DIRECT = ["png", "jpg", "jpeg", "gif", "svg", "webp", "pdf", "txt", "md"];
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

  function buildRow(fileRow, path) {
    var row = mkEl("div", "ws-file");

    var ico = mkEl("span", "ws-ico", "\uD83D\uDCC4");
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
      var preview = mkEl("a", "ws-link preview", "\u5728\u7EBF\u9884\u89C8");
      preview.href = kind === "viewer" ? "./viewer.html?doc=" + encodePath(path) : "./" + encodePath(path);
      preview.target = "_blank";
      preview.rel = "noopener";
      acts.appendChild(preview);
    }

    var dl = mkEl("a", "ws-link dl", "\u4E0B\u8F7D");
    dl.href = "./" + encodePath(path);
    dl.setAttribute("download", fileRow.name);
    acts.appendChild(dl);

    row.appendChild(ico);
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
        var ico = mkEl("span", "ws-ico", "\uD83D\uDCC1");
        var name = mkEl("span", "ws-name", node.name);
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