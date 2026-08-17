(function () {
  "use strict";

  var fileName = "";

  function byId(id) {
    return document.getElementById(id);
  }

  function sanitize(raw) {
    if (!raw) return "";
    var f = String(raw).split(/[?#]/)[0].trim();
    if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(f)) return "";
    f = f.replace(/\\/g, "/");
    var parts = f.split("/");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === "" || p === "." || p === "..") return "";
      out.push(p);
    }
    if (!out.length) return "";
    return out.join("/");
  }

  function basename(file) {
    return file.split("/").pop().replace(/\.[^.]+$/, "");
  }

  function showError(main, hint) {
    byId("wsMsg").textContent = main;
    byId("wsHint").textContent = hint || "";
    byId("wsOverlay").classList.add("error");
    byId("wsSpinner").style.display = "none";
  }

  function slugify(text) {
    return String(text)
      .replace(/<[^>]+>/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\u00C0-\uFFFF]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  }

  function renderMarkdown(text) {
    var renderer = new marked.Renderer();
    renderer.heading = function (headingText, level) {
      var id = slugify(headingText);
      return (
        "<h" + level + ' id="' + id + '">' + headingText + ' <a class="md-anchor" href="#' + id + '" aria-hidden="true">#</a></h' + level + ">"
      );
    };
    marked.setOptions({ gfm: true, breaks: true });
    marked.use({ renderer: renderer, breaks: true });

    var rawHtml = marked.parse(text);
    var clean = DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "referrerpolicy", "frameborder"]
    });
    byId("mdContent").innerHTML = '<div class="md-wrap">' + clean + "</div>";
  }

  function enhance() {
    var content = byId("mdContent");

    var codes = content.querySelectorAll("pre code");
    for (var i = 0; i < codes.length; i++) {
      try {
        hljs.highlightElement(codes[i]);
      } catch (e) {
        // 无法高亮的语言保持原样
      }
    }

    if (window.katex && window.renderMathInElement) {
      renderMathInElement(content, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
      });
    }
  }

  function jumpToHash() {
    var m = location.hash;
    if (!m || !rendered) return;
    var el = document.querySelector(m.replace(/['"\\]/g, ""));
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" });
  }

  var rendered = false;

  function load() {
    fetch("../" + fileName, { cache: "default" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        try {
          renderMarkdown(text);
          enhance();
          rendered = true;
          byId("wsOverlay").style.display = "none";
          jumpToHash();
        } catch (e) {
          showError("渲染失败", fileName + "（" + (e && e.message) + "）");
        }
      })
      .catch(function (err) {
        showError("无法加载文件", fileName + "（" + (err && err.message) + "）");
      });
  }

  function init() {
    var params = new URLSearchParams(location.search);
    fileName = sanitize(params.get("doc") || "");
    if (!fileName) {
      showError("缺少文件参数", "地址中需要 ?doc=<相对路径>.md，例如 mdpreview.html?doc=doc.md。");
      return;
    }

    byId("wsTitle").textContent = basename(fileName);
    document.title = basename(fileName) + " · Markdown";
    byId("wsRaw").href = "../" + fileName;
    byId("wsDownload").href = "../" + fileName;
    byId("wsDownload").setAttribute("download", fileName.split("/").pop());

    load();
  }

  init();
})();