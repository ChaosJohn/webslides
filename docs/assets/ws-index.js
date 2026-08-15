(function () {
  "use strict";

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

  function basename(file) {
    return file.replace(/\.[^.]+$/, "");
  }

  function buildCard(deck) {
    var card = document.createElement("div");
    card.className = "ws-card";

    var name = document.createElement("div");
    name.className = "name";
    name.textContent = basename(deck.file);

    var meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = "<span>" + formatSize(deck.size) + "</span><span>" + formatDate(deck.modified) + "</span>";

    var actions = document.createElement("div");
    actions.className = "actions";

    if (deck.type === "pptx") {
      var viewBtn = document.createElement("a");
      viewBtn.className = "ws-btn primary";
      viewBtn.href = "./viewer.html?doc=" + encodeURIComponent(deck.file);
      viewBtn.target = "_blank";
      viewBtn.rel = "noopener";
      viewBtn.textContent = "在线浏览";

      var dlBtn = document.createElement("a");
      dlBtn.className = "ws-btn ghost";
      dlBtn.href = "./" + deck.file;
      dlBtn.target = "_blank";
      dlBtn.rel = "noopener";
      dlBtn.textContent = "下载原件";

      actions.appendChild(viewBtn);
      actions.appendChild(dlBtn);
    } else {
      var openBtn = document.createElement("a");
      openBtn.className = "ws-btn primary";
      openBtn.href = "./" + deck.file;
      openBtn.target = "_blank";
      openBtn.rel = "noopener";
      openBtn.textContent = "打开查看";
      actions.appendChild(openBtn);
    }

    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(actions);
    return card;
  }

  function render(manifest) {
    var decks = manifest.decks || [];

    var pptxDecks = decks.filter(function (d) {
      return d.type === "pptx";
    });
    var htmlDecks = decks.filter(function (d) {
      return d.type === "html";
    });

    document.getElementById("wsCountPptx").textContent = "共 " + pptxDecks.length + " 份";
    document.getElementById("wsCountHtml").textContent = "共 " + htmlDecks.length + " 份";

    var pptxGrid = document.getElementById("wsGridPptx");
    var htmlGrid = document.getElementById("wsGridHtml");

    if (!pptxDecks.length) {
      pptxGrid.innerHTML = '<p style="color:#8a8f96;font-size:13px;">暂无 PPT 文件。</p>';
    }
    pptxDecks.forEach(function (d) {
      pptxGrid.appendChild(buildCard(d));
    });

    if (!htmlDecks.length) {
      htmlGrid.innerHTML = '<p style="color:#8a8f96;font-size:13px;">暂无 HTML 幻灯片。</p>';
    }
    htmlDecks.forEach(function (d) {
      htmlGrid.appendChild(buildCard(d));
    });

    document.getElementById("wsSummary").textContent =
      "索引生成时间：" + formatDate(manifest.generated) + "（由 GitHub Actions 自动更新，往 docs 目录加入新的 .pptx / .html 后自动同步列表）";
  }

  function showError(err) {
    var pptxGrid = document.getElementById("wsGridPptx");
    var htmlGrid = document.getElementById("wsGridHtml");
    var msg =
      "无法加载 <code>manifest.json</code>（" + err + "）。请确认已经 push 代码，且 GitHub Actions 工作流 <code>Generate deck index</code> 已成功执行并提交了 manifest.json。";
    pptxGrid.innerHTML = "<p style='color:#b33a3a;font-size:13px;'>" + msg + "</p>";
    htmlGrid.style.display = "none";
    document.getElementById("wsCountPptx").textContent = "";
    document.getElementById("wsCountHtml").textContent = "";
  }

  fetch("./manifest.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      showError(err.message || String(err));
    });
})();