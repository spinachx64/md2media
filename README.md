# md2media

本地 Markdown 排版工具。当前支持把 Markdown 转成微信公众号可直接粘贴的内联样式 HTML，后续可扩展到其他媒体平台。

特点：

- 本地转换，不上传文章内容
- 主题 CSS 可版本管理
- 输出 HTML 已内联样式，适配微信公众号编辑器
- 支持本地预览和一键复制

## 安装

需要 Node.js 18+。

```bash
npm install
```

## 使用

### 命令行

```bash
node build.mjs article.md
node build.mjs article.md -t summer-breeze
node build.mjs article.md --stdout
node build.mjs --list
```

默认会把渲染后的富文本复制到剪贴板，直接粘贴进公众号编辑器即可。

常用参数：

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `-t, --theme <name>` | 指定主题 | `summer-breeze` |
| `--stdout` | 输出到标准输出 | - |
| `-l, --list` | 列出主题 | - |

### 本地预览

```bash
node serve.mjs
```

打开 `http://localhost:5333`，选择文章和主题，确认效果后点击“复制到公众号”。

默认文章目录是项目的上层目录，适合这样的结构：

```text
writing/
  article-a.md
  article-b.md
  md2media/
```

也可以手动指定：

```bash
node serve.mjs --dir /path/to/articles
```

## 主题

主题放在 `themes/`，一个 CSS 文件就是一套主题。

内置主题：

- `summer-breeze`：默认主题，夏日海风风格
- `mint-terminal`：薄荷终端风格
- `graphite-orange`：石墨橙风格
- `mdnice-classic`：经典蓝色风格

新增主题：

```bash
cp themes/mint-terminal.css themes/my-theme.css
node build.mjs article.md -t my-theme
```

主题规则：

- 选择器必须以 `#nice` 开头
- 尽量使用固定 `px` 和 `hex`，不要依赖 CSS 变量
- 微信兼容性优先，少用复杂布局属性

新增主题和调试细节见 [themes/README.md](themes/README.md)。

## 目录

```text
build.mjs                      CLI 入口
serve.mjs                      本地预览服务
render.mjs                     Markdown 渲染和样式内联
themes/                        主题 CSS 和主题说明
themes/syntax-test.md          Markdown 语法测试样例
themes/palette-preview.html    主题配色预览页
```

## 说明

微信公众号会清理 `<style>` 和 class，所以本项目使用 `juice` 把主题 CSS 内联到每个标签上。

代码高亮由 `highlight.js` 生成，主题文件里包含对应 `.hljs-*` 样式。

## License

MIT
