(function () {
  "use strict";

  var fileName = "";
  var slides = []; // 原始 .slide DOM（渲染完成后剥离）
  var frames = []; // 舞台中的 .ws-frame
  var cur = 0;
  var slideW = 1280;
  var slideH = 720;
  var unsupported = []; // 每页无法完整渲染的元素标识
  var rendered = false;
  var lastSwipeAt = 0;
  var THUMB_W = 168;

  var $ = window.jQuery;

  function byId(id) {
    return document.getElementById(id);
  }

  function sanitize(raw) {
    if (!raw) return "";
    var f = String(raw).replace(/[?#].*$/, "").trim();
    f = String(f).split(/[\\/]/).pop();
    if (!f || f === "." || f === "..") return "";
    return f;
  }

  function basename(file) {
    return file.replace(/\.[^.]+$/, "");
  }

  function showError(main, hint) {
    byId("wsMsg").textContent = main;
    byId("wsHint").textContent = hint || "";
    byId("wsOverlay").classList.add("error");
  }

  function hideOverlay() {
    byId("wsOverlay").style.display = "none";
  }

  // ============================ 预处理：扫描原生 PPTX ============================

  function parseAttrs(str) {
    var out = {};
    var re = /([\w:.-]+)=(["'])([\s\S]*?)\2/g;
    var m;
    while ((m = re.exec(str))) out[m[1]] = m[3];
    return out;
  }

  function presentationOrder(zip) {
    var order = [];
    var presRel = zip.file("ppt/_rels/presentation.xml.rels");
    var presXml = zip.file("ppt/presentation.xml");
    if (!presRel || !presXml) return order;

    var rels = {};
    var reRel = /<Relationship\b([^>]*)\/?>/g;
    var m;
    while ((m = reRel.exec(presRel.asText()))) {
      var a = parseAttrs(m[1]);
      if (a.Type && a.Type.indexOf("slide") !== -1 && a.Target) {
        rels[a.Id] = a.Target.replace(/^\.?\//, "");
      }
    }

    var reSld = /<p:sldId\b([^>]*)\/?>/g;
    var ids = [];
    while ((m = reSld.exec(presXml.asText()))) ids.push(parseAttrs(m[1]).rId);

    for (var i = 0; i < ids.length; i++) {
      var target = rels[ids[i]];
      if (!target) continue;
      var base = target.split("/").pop().replace(/\.xml$/, "");
      if (/^slide\d+$/.test(base)) order.push(base);
    }
    return order;
  }

  function scanDeck(buffer) {
    var flags = {};
    var zip = null;
    try {
      zip = new JSZip();
      zip.load(buffer);
    } catch (e) {
      return flags;
    }

    try {
      var order = presentationOrder(zip);
      var idxByBase = {};
      order.forEach(function (base, i) {
        idxByBase[base] = i;
      });

      var entries = [];
      if (typeof zip.forEach === "function") {
        zip.forEach(function (path, file) {
          entries.push([path, file]);
        });
      } else if (zip.files && typeof zip.files === "object") {
        Object.keys(zip.files).forEach(function (path) {
          entries.push([path, zip.files[path]]);
        });
      }

      entries.forEach(function (pair) {
        var path = pair[0];
        var file = pair[1];
        var m = /^ppt\/slides\/(slide\d+)\.xml$/.exec(path);
        if (!m) return;
        var idx = order.length ? idxByBase[m[1]] : parseInt(m[1].replace("slide", ""), 10) - 1;
        if (idx < 0) return;

        var xml = file.asText();
        var f = [];
        if (/<c:chart\b/.test(xml)) f.push("图表");
        if (/<p:oleObj\b/.test(xml)) f.push("嵌入对象");
        if (/<a:(videoFile|audioFile)\b/.test(xml) || /<p:(media|video|audio)\b/.test(xml)) f.push("音视频");
        if (/graphicData[^>]*uri="http:\/\/schemas\.openxmlformats\.org\/drawingml\/2006\/diagram/.test(xml))
          f.push("SmartArt");
        if (f.length) flags[idx] = f;
      });
    } catch (e) {
      return flags;
    }

    return flags;
  }

  // ============================ 加载与渲染 ============================

  function waitForRender() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var slidesCount = $("#renderRoot #all_slides_warpper > .slide").length;
      var loadingMsg = $("#renderRoot .slides-loadnig-msg").length;
      if (slidesCount > 0 && loadingMsg === 0) {
        clearInterval(iv);
        onRendered();
      } else if (tries > 450) {
        clearInterval(iv);
        showError("渲染超时", "浏览器解析该 .pptx 超出预期时间，请刷新重试或下载原件查看。");
      }
    }, 80);
  }

  function loadDeck() {
    if (!($ && $.fn && $.fn.pptxToHtml) || typeof JSZip === "undefined") {
      showError("渲染脚本未能加载", "查看器依赖若干 CDN 脚本，请检查网络后刷新重试。（jQuery / JSZip / PPTXJS）");
      return;
    }

    fetch(fileName, { cache: "default" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.arrayBuffer();
      })
      .then(function (buffer) {
        try {
          unsupported = scanDeck(buffer);
        } catch (e) {
          unsupported = [];
        }

        $("#renderRoot").pptxToHtml({
          pptxFileUrl: fileName,
          slideMode: false,
          mediaProcess: true,
          themeProcess: true,
          keyBoardShortCut: false
        });
        waitForRender();
      })
      .catch(function (err) {
        showError("无法加载文件", fileName + "（" + (err && err.message) + "），请确认文件存在于 docs 目录。");
      });
  }

  function onRendered() {
    var $slideEls = $("#renderRoot #all_slides_warpper").children(".slide");
    if (!$slideEls.length) {
      showError("未解析到任何幻灯片", "该 .pptx 可能为空或格式不受支持，可下载原件查看。");
      return;
    }

    $slideEls.each(function () {
      slides.push(this);
    });

    slideW = slides[0].clientWidth || parseInt(slides[0].style.width, 10) || 1280;
    slideH = slides[0].clientHeight || parseInt(slides[0].style.height, 10) || 720;

    var stage = byId("wsStage");
    slides.forEach(function (el, i) {
      var frame = document.createElement("div");
      frame.className = "ws-frame";
      frame.dataset.index = i;
      frame.appendChild(el);
      stage.appendChild(frame);
    });
    frames = Array.prototype.slice.call(stage.children);

    byId("renderRoot").style.display = "none";

    buildRail();
    wireEvents();
    layout();

    var start = readHash();
    goTo(start);
    rendered = true;
    hideOverlay();
    byId("wsRailWrap").hidden = false;
  }

  // ============================ 舞台与导航 ============================

  function layout() {
    if (!frames.length) return;
    var stage = byId("wsStage");
    var W = stage.clientWidth;
    var H = stage.clientHeight;
    if (!W || !H) return;
    var s = Math.min(W / slideW, H / slideH) * 0.98;
    frames.forEach(function (f) {
      f.style.width = slideW + "px";
      f.style.height = slideH + "px";
      f.style.transform = "translate(-50%, -50%) scale(" + s + ")";
    });
  }

  function readHash() {
    var m = /#slide=(\d+)/.exec(location.hash);
    if (!m) return 0;
    var n = parseInt(m[1], 10);
    return isNaN(n) ? 0 : n - 1;
  }

  function goTo(i) {
    if (!frames.length) return;
    i = Math.max(0, Math.min(frames.length - 1, i));
    cur = i;

    frames.forEach(function (f, idx) {
      f.classList.toggle("active", idx === i);
    });

    byId("wsCounter").textContent = (i + 1) + " / " + frames.length;
    byId("wsTitle").textContent = basename(fileName) + "（第 " + (i + 1) + " 页）";
    document.title = basename(fileName) + " · 第 " + (i + 1) + " 页";

    var h = "#slide=" + (i + 1);
    if (location.hash !== h) location.hash = h;

    updateThumbs();
    updateWarn();
  }

  function updateThumbs() {
    var thumbs = $("#wsRail .ws-thumb");
    thumbs.removeClass("active");
    thumbs.eq(cur).addClass("active");
    if (thumbs[cur]) {
      thumbs[cur].scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function updateWarn() {
    var flags = unsupported[cur];
    var warn = byId("wsWarn");
    if (flags && flags.length) {
      byId("wsWarnText").textContent =
        "本页包含网页端可能无法 100% 还原的元素：" + flags.join("、") + "。为获得与 PowerPoint 完全一致的效果，请";
      warn.hidden = false;
    } else {
      warn.hidden = true;
    }
  }

  // ============================ 缩略图导航栏 ============================

  function buildRail() {
    var rail = byId("wsRail");
    rail.innerHTML = "";

    frames.forEach(function (frame, i) {
      var src = frame.firstElementChild;

      var thumb = document.createElement("div");
      thumb.className = "ws-thumb";
      thumb.setAttribute("role", "button");
      thumb.setAttribute("aria-label", "第 " + (i + 1) + " 页");
      thumb.title = "第 " + (i + 1) + " 页";
      thumb.dataset.index = i;

      var inner = document.createElement("div");
      inner.className = "inner";
      var k = THUMB_W / slideW;
      inner.style.width = slideW + "px";
      inner.style.height = slideH + "px";
      inner.style.transform = "scale(" + k + ")";
      inner.appendChild(src.cloneNode(true));

      thumb.style.width = THUMB_W + "px";
      thumb.style.height = Math.round(slideH * k) + "px";
      thumb.appendChild(inner);

      var num = document.createElement("span");
      num.className = "num";
      num.textContent = i + 1;
      thumb.appendChild(num);

      if (unsupported[i] && unsupported[i].length) {
        var badge = document.createElement("span");
        badge.className = "warn-badge";
        badge.textContent = "!";
        badge.title = "本页含可能无法完整渲染的元素：" + unsupported[i].join("、");
        thumb.appendChild(badge);
      }

      thumb.addEventListener("click", function () {
        goTo(parseInt(this.dataset.index, 10));
      });

      rail.appendChild(thumb);
    });
    updateThumbs();
  }

  // ============================ 交互 ============================

  function toggleFullscreen() {
    var el = byId("fullscreenRoot");
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    } else {
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (req) req.call(el);
    }
  }

  function wireEvents() {
    byId("wsPrev").addEventListener("click", function () {
      goTo(cur - 1);
    });
    byId("wsNext").addEventListener("click", function () {
      goTo(cur + 1);
    });
    byId("wsFull").addEventListener("click", toggleFullscreen);

    var stage = byId("wsStage");

    stage.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      if (Date.now() - lastSwipeAt < 400) return;
      goTo(cur + 1);
    });

    var tx0 = null;
    var ty0 = null;
    stage.addEventListener("touchstart", function (e) {
      var t = e.changedTouches[0];
      tx0 = t.clientX;
      ty0 = t.clientY;
    });
    stage.addEventListener("touchend", function (e) {
      if (tx0 === null) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - tx0;
      var dy = t.clientY - ty0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        lastSwipeAt = Date.now();
        goTo(cur + (dx < 0 ? 1 : -1));
      }
      tx0 = null;
      ty0 = null;
    });

    document.addEventListener("keydown", function (e) {
      if (!rendered) return;
      if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || "").toUpperCase())) return;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          e.preventDefault();
          goTo(cur + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          goTo(cur - 1);
          break;
        case "Home":
          goTo(0);
          break;
        case "End":
          goTo(frames.length - 1);
          break;
        case " ":
          e.preventDefault();
          goTo(cur + 1);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "Escape":
          if (document.fullscreenElement || document.webkitFullscreenElement) toggleFullscreen();
          break;
      }
    });

    window.addEventListener("hashchange", function () {
      if (!rendered) return;
      goTo(readHash());
    });

    var rsTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(rsTimer);
      rsTimer = setTimeout(layout, 60);
    });

    var syncLayout = function () {
      clearTimeout(rsTimer);
      setTimeout(layout, 120);
    };
    document.addEventListener("fullscreenchange", syncLayout);
    document.addEventListener("webkitfullscreenchange", syncLayout);
  }

  // ============================ 启动 ============================

  function init() {
    var params = new URLSearchParams(location.search);
    fileName = sanitize(params.get("doc") || "");

    if (!fileName) {
      showError(
        "缺少文件参数",
        "请在地址中加入 ?doc=<文件名>.pptx，例如 viewer.html?doc=" + "demo" + ".pptx。或先访问首页选择一份演示文稿。"
      );
      return;
    }

    if (!/\.(pptx|pptm)$/i.test(fileName)) {
      showError("不支持的格式", "本查看器仅支持 .pptx / .pptm 文件：" + fileName);
      return;
    }

    byId("wsDownload").href = fileName;
    byId("wsWarnLink").href = fileName;
    byId("wsCounter").textContent = "加载中";
    document.title = basename(fileName);

    loadDeck();
  }

  init();
})();