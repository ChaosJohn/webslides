(function () {
  "use strict";

  var fileName = "";
  var MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js";

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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMarkdown(text) {
    var renderer = new marked.Renderer();
    renderer.heading = function (headingText, level) {
      var id = slugify(headingText);
      return (
        "<h" + level + ' id="' + id + '">' + headingText + ' <a class="md-anchor" href="#' + id + '" aria-hidden="true">#</a></h' + level + ">"
      );
    };
    renderer.code = function (code, infostring, escaped) {
      var lang = (infostring || "").trim().split(/\s+/)[0] || "";
      if (lang === "mermaid") {
        return '<pre class="mermaid">' + escapeHtml(code) + "</pre>";
      }
      var cls = lang ? ' class="language-' + escapeHtml(lang) + '"' : "";
      return "<pre><code" + cls + ">" + (escaped ? code : escapeHtml(code)) + "</code></pre>";
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

  // ============ 目录 ============

  var tocState = null;

  function buildToc() {
    var content = byId("mdContent");
    var headings = Array.prototype.slice.call(content.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    var toc = byId("mdToc");
    var toggle = byId("mdTocToggle");

    if (!headings.length) {
      toc.hidden = true;
      toggle.style.display = "none";
      return;
    }

    // 去重 id
    var seen = {};
    var minLevel = 99;
    headings.forEach(function (h) {
      var base = h.id || slugify(h.textContent);
      var id = base;
      var n = 1;
      while (seen[id]) {
        n++;
        id = base + "-" + n;
      }
      seen[id] = true;
      h.id = id;
      var a = h.querySelector(".md-anchor");
      if (a) a.setAttribute("href", "#" + id);
      var lv = parseInt(h.tagName.charAt(1), 10);
      if (lv < minLevel) minLevel = lv;
    });

    toc.innerHTML = "";
    var ul = document.createElement("ul");
    ul.className = "md-toc-list";
    headings.forEach(function (h) {
      var lv = parseInt(h.tagName.charAt(1), 10);
      var li = document.createElement("li");
      li.className = "md-toc-item";
      li.style.setProperty("--tlv", (lv - minLevel) + 1);
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent.replace(/\s*#$/, "").trim();
      a.dataset.target = h.id;
      li.appendChild(a);
      ul.appendChild(li);
    });
    toc.appendChild(ul);

    toc.hidden = false;
    toggle.style.display = "";
    toggle.textContent = tocState ? "☰" : "☰";

    // 点击目录项
    ul.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      var el = document.getElementById(a.dataset.target);
      if (el && el.scrollIntoView) {
        var scroller = document.querySelector(".md-content");
        var top = el.getBoundingClientRect().top + (scroller ? scroller.scrollTop : 0) - 14;
        if (scroller) scroller.scrollTo({ top: top, behavior: "smooth" });
        else el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      history.replaceState(null, "", "#" + a.dataset.target);
      closeTocMobile();
    });

    // 滚动高亮
    if ("IntersectionObserver" in window) {
      var root = content;
      var spy = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var cur = toc.querySelector("a[data-target='" + en.target.id + "']");
            var prev = toc.querySelector(".active");
            if (prev) prev.classList.remove("active");
            if (cur) cur.classList.add("active");
          });
        },
        { root: root, rootMargin: "-8% 0px -75% 0px", threshold: 0 }
      );
      headings.forEach(function (h) {
        spy.observe(h);
      });
    }
  }

  function setupTocToggle() {
    var toggle = byId("mdTocToggle");
    var toc = byId("mdToc");
    if (!toggle || !toc) return;

    var mobile = window.matchMedia("(max-width: 900px)");
    var isMobile = mobile.matches;

    function apply(state) {
      tocState = state;
      document.body.classList.toggle("toc-off", !state);
      toggle.setAttribute("aria-expanded", state ? "true" : "false");
    }
    function currentOn() {
      if (isMobile) return !document.body.classList.contains("toc-off");
      return !document.body.classList.contains("toc-off");
    }

    // 默认：桌面开、移动端关
    if (isMobile) apply(false);
    else apply(true);

    toggle.addEventListener("click", function () {
      apply(!currentOn());
    });

    mobile.addEventListener("change", function (e) {
      isMobile = e.matches;
      if (!isMobile) apply(true);
      else apply(false);
    });
  }

  function closeTocMobile() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      document.body.classList.add("toc-off");
    }
  }

  // ============ Mermaid ============

  function renderMermaid() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("#mdContent pre.mermaid"));
    if (!nodes.length) return;
    if (window.mermaid) {
      runMermaid(nodes);
      return;
    }
    var s = document.createElement("script");
    s.src = MERMAID_CDN;
    s.onload = function () {
      runMermaid(nodes);
    };
    s.onerror = function () {
      console.warn("mermaid 加载失败，保持代码块原文");
    };
    document.head.appendChild(s);
  }

  function runMermaid(nodes) {
    try {
      window.mermaid.initialize({ startOnLoad: false });
      window.mermaid.run({ nodes: nodes });
    } catch (e) {
      console.warn("mermaid 渲染失败", e);
    }
  }

  // ============ 启动 ============

  function jumpToHash() {
    var m = location.hash;
    if (!m || !rendered) return;
    var el = document.querySelector(m.replace(/['"\\]/g, ""));
    if (el && el.scrollIntoView) {
      var scroller = document.querySelector(".md-content");
      var top = el.getBoundingClientRect().top + (scroller ? scroller.scrollTop : 0) - 14;
      if (scroller) scroller.scrollTo({ top: top, behavior: "smooth" });
      else el.scrollIntoView({ block: "start" });
    }
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
          buildToc();
          setupTocToggle();
          renderMermaid();
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