# WebSlides

基于 GitHub Pages 托管在 `docs/` 目录下，在浏览器中直接在线浏览 PPT 演示文稿（.pptx）与 HTML 幻灯片。

## 浏览方式

- **首页**：https://slides.99se.cn/ 自动列出全部演示文稿。`.pptx` 支持「在线浏览」，`.html` 直接点击打开。
- **查看器**：`viewer.html?doc=<文件名>.pptx`，支持：
  - 键盘：`←` `→` 翻页、`Space` 下一页、`Home`/`End` 跳转首末页、`F` 全屏、`Esc` 退出全屏
  - 底部缩略图导航栏，点击跳页
  - 每页独立链接：`viewer.html?doc=<文件名>.pptx#slide=3`
  - 手机触摸左右滑动翻页
  - 图表、嵌入对象、音视频、SmartArt 等网页端无法 100% 还原的元素会明示提示，并可在工具栏下载原件

## 添加新的 pptx / html

1. 直接把文件放进 `docs/` 目录并 push 到 `main` 分支。
2. GitHub Actions 工作流 `.github/workflows/generate-index.yml` 会在 push 后自动扫描 `docs/` 并生成 `docs/manifest.json`，首页列表随之更新，无需手动维护。

## 本地预览

```bash
# 生成 manifest（本地未跑 Actions 时手动执行一次）
node scripts/generate-manifest.mjs

# 起一个静态服务器预览（注意须用 http 协议，直接 file:// 打开无法 fetch）
python3 -m http.server 8000 --directory docs
# 打开 http://localhost:8000/
```

## 实现说明

- 渲染引擎：[PPTXJS](https://github.com/meshesha/PPTXJS)（前端运行时解析渲染，无需构建步骤），及其依赖 jQuery / JSZip v2 / d3 / nv.d3，均通过 jsDelivr CDN 引入。
- 高保真范围：文字、形状、颜色、表格按原版式渲染；动画、过渡及原生图表等不做支持，采用降级提示 + 原件下载。
- `.nojekyll` 位于 `docs/`，关闭 Jekyll 处理以确保静态文件原样托管。

## 目录结构

```
docs/
  index.html               # 自动列表首页
  viewer.html              # PPT 查看器
  manifest.json            # 文件清单（由 GitHub Actions 自动生成）
  assets/ws-style.css      # 共享样式
  assets/ws-index.js       # 首页逻辑
  assets/ws-viewer.js      # 查看器逻辑
  *.pptx / *.html          # 需要托管的演示文稿
scripts/generate-manifest.mjs   # 生成 manifest.json 的脚本
.github/workflows/generate-index.yml
```