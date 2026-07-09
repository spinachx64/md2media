---
name: md2media
description: 使用本地 md2media 工具，把写完的 Markdown 文章构建成微信公众号可用的内联样式 HTML。当用户已有一篇 .md 文章，想运行 node md2media/build.mjs、选择或列出主题、输出 HTML、复制富文本到公众号，或在本地预览渲染效果时使用。
---

# md2media

- 使用本技能，通过本地 `md2media` 项目，把一篇写完的 Markdown 文档转换成微信公众号可用的 HTML。
- **默认从上下文中推理最新生成的文章。**

## 工作流程

1. 确认 Markdown 文件存在，且就是你要处理的源文章。
2. 在包含 `md2media/` 项目文件夹的目录下，运行：

```bash
node md2media/build.mjs path/to/article.md
```

3. 如果当前工作目录已经是 `md2media` 项目目录，运行：

```bash
node build.mjs path/to/article.md
```

4. 在 macOS 和受支持的 Windows 环境下，默认构建会把富文本和纯文本一起写入剪贴板，可直接粘贴进公众号编辑器。在 Linux 上，或剪贴板不可用时，使用 `--stdout` 并自行处理 HTML 输出。

## 常用命令

列出可用主题：

```bash
node md2media/build.mjs --list
```

用指定主题构建：

```bash
node md2media/build.mjs path/to/article.md -t summer-breeze
```

把 HTML 打印到标准输出：

```bash
node md2media/build.mjs path/to/article.md --stdout
```

启动本地预览服务：

```bash
node md2media/serve.mjs
```

如果是在 `md2media` 项目目录内运行，去掉这些命令里的 `md2media/` 前缀即可。

## 注意事项

- 需要 Node.js 18+，并已通过 `npm install` 安装项目依赖。
- 默认主题是 `summer-breeze`。
- 内置主题包括 `summer-breeze`、`mint-terminal`、`graphite-orange` 和 `mdnice-classic`。
- 主题 CSS 文件位于 `md2media/themes/`；使用 `-t <主题名>` 时不带 `.css` 后缀。
