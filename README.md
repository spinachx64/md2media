# mdwx — 本地 Markdown → 微信公众号排版工具

把本地写好的 Markdown 文章，一键转换成微信公众号可直接粘贴的 HTML。

替代 [mdnice](https://editor.mdnice.com/) 的在线转换：不用上传、不联网，主题自己说了算，还能进 Git。

## 它解决什么问题

微信公众号编辑器**只认内联样式**（`style="..."`），会把 `<style>` 标签和 class 选择器全部剥掉。所以不能直接贴 Markdown 转出的普通 HTML。

mdwx 的核心流程就一句：

```
Markdown → 套主题 CSS → 把 CSS 全部内联到每个标签 → 微信可粘贴的 HTML
```

内联这一步用的是 [juice](https://github.com/Automattic/juice)，这也是 mdnice 在做的事。

## 安装

首次使用先装依赖（只需一次）：

```bash
cd mdwx
npm install
```

需要 Node 18+（本机为 v24）。

## 本地目录约定

这个项目可以作为一个独立 Git 仓库放在你的写作目录下面，例如：

```
writing/
  article-a.md
  article-b.md
  mdwx/
```

这种结构下，`mdwx/.git` 只管理工具本身，不会把上层写作目录里的文章提交进去。

预览服务默认读取 `mdwx` 的上层目录，也就是上面的 `writing/`。所以保持这个结构时，直接运行：

```bash
cd mdwx
node serve.mjs
```

如果别人把 mdwx 单独 clone 到任意位置，也可以显式指定文章目录：

```bash
node serve.mjs --dir /path/to/articles
```

## 用法一：命令行转换（日常出稿）

```bash
cd mdwx

node build.mjs ../mcp3.md                # 产出 ../mcp3.html
node build.mjs ../mcp3.md -t 主题名       # 指定主题
node build.mjs ../mcp3.md -o out.html    # 指定输出文件名
node build.mjs ../mcp3.md --copy         # 直接复制到剪贴板（macOS），粘贴即用
node build.mjs ../mcp3.md -c             # --copy 的简写
node build.mjs ../mcp3.md -t 主题名 --copy # 指定主题并直接复制
```

参数一览：

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `-t, --theme <名字>` | 指定主题 | `mint-terminal` |
| `-o, --out <文件>` | 输出文件路径 | 与输入同名 `.html` |
| `--stdout` | 输出到标准输出，不写文件 | — |
| `-c, --copy` | 渲染后直接复制到剪贴板（仅 macOS） | — |
| `-l, --list` | 列出所有可用主题 | — |
| `-h, --help` | 显示帮助 | — |

两种拿到成品的方式：

- **产出 html 文件**：用浏览器打开 → 全选（Cmd+A）→ 复制 → 粘贴进公众号编辑器。
- **`--copy` 直接复制**（推荐，macOS）：渲染结果作为富文本直接写进剪贴板，连 html 文件和浏览器都省了，粘贴即用。

两种方式样式都已全部内联，微信不会剥掉。

## 用法二：本地预览页（发布前看一眼 + 一键复制）

```bash
cd mdwx
node serve.mjs                           # 打开 http://localhost:5333
```

- 左边：选文章、切主题
- 右边：实时预览公众号里的效果
- 顶部「复制到公众号」按钮：点一下富文本直接进剪贴板，连产出 html 文件都省了，粘贴即用

发布前想看一眼效果、临时改改再发，用这个最方便。

## 多套主题

主题就是 `themes/` 下的 CSS 文件，**一套一个，文件名即主题名**。

```
themes/
  mint-terminal.css      # 默认主题，薄荷终端风格
  graphite-orange.css    # 石墨橙风格
  mdnice-classic.css     # 仿 mdnice 常用风格
```

### 加一套新主题

1. 复制一份现有的 `.css`，改个名字，比如 `themes/my-style.css`
2. 改里面的配色、间距、字号
3. 完成。预览页下拉会自动扫到，CLI 用 `-t my-style` 即可

改主题不用动任何代码。

### 写主题的注意事项

- 所有样式都要写在 `#nice` 作用域下（如 `#nice h2 { ... }`），juice 才能正确内联，也避免污染。
- 微信对某些 CSS 支持有限，尽量用基础属性（color、margin、padding、border、font-size、background 等），避免 flex/grid 等复杂布局。
- `h2::before` 这类装饰性伪元素可以用，已开启内联支持。

## 项目结构

```
mdwx/
  render.mjs          核心：md → 套主题 → juice 内联（CLI 和预览页共用）
  build.mjs           命令行入口
  serve.mjs           本地预览页入口
  themes/             主题 CSS，一套一个文件
  syntax-test.md      Markdown 语法测试样例
  palette-preview.html 主题配色预览页
  package.json
  README.md
```

## 开源与提交

仓库已配置 `.gitignore`，默认不会提交：

- `node_modules/`
- 转换生成的 `*.html`
- `.env*`、日志、系统和编辑器临时文件

`package-lock.json` 建议提交，方便复现依赖版本。

## 常见问题

**粘进公众号样式丢了？**
确认用的是 mdwx 产出的 html（或预览页的复制按钮），而不是原始 Markdown。产出的 html 里每个标签都应带 `style="..."`。

**粘进公众号显示成 HTML 源码，没渲染？**
原因是复制的内容中途经过了纯文本环节。剪贴板同时存 `text/plain`（纯文本）和 `text/html`（富文本）两份，公众号读的是 `text/html`。而 VS Code、备忘录、txt 这类纯文本编辑器会丢掉 `text/html`，只留源码字符串——从它们再复制，公众号读到的就只剩源码了。
所以必须**一步到位**：从「浏览器打开的 html 页面」「预览页复制按钮」或 `--copy` 直接粘进公众号，中间不要经过任何纯文本编辑器。

**代码块没高亮？**
高亮由 highlight.js 生成并内联，主题 CSS 里需要有对应的 `.hljs` 配色。内置主题已包含对应配色。

**想换端口？**
`serve.mjs` 里默认 5333，直接改常量即可。
