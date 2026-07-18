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

默认会把渲染后的富文本复制到剪贴板，直接粘贴进公众号编辑器即可。macOS 走 `osascript`，Windows 走 PowerShell 的剪贴板 API，两者都会同时写入富文本和纯文本两份。其他系统请用 `--stdout` 输出 HTML，或用本地预览服务复制。

不指定主题时，会使用构建机器的本地日期自动选择 12 个月 × 每月 9 段的年度主题；每个上、中、下旬再细分为初、正、末三段。`-t/--theme` 始终优先，可用于复建历史文章。

常用参数：

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `-t, --theme <name>` | 指定主题；未指定时按本地日期自动选择年度主题 | 当前日期对应的季节主题 |
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

## 作为 Skill 使用

项目自带一个 Skill（`skill/SKILL.md`），让 Claude Code 或 Codex 在你说“把这篇文章转成公众号 HTML”时，自动调用 `build.mjs` 完成转换、选主题、复制富文本。

### 推荐的目录结构

建议把 `md2media` 项目直接放在你的写作目录下，文章和工具在一起，`serve.mjs` 默认的上层目录就是文章目录，开箱即用：

```text
writing/                    # 你的写作目录
  article-a.md
  article-b.md
  md2media/                 # 本项目
    build.mjs
    serve.mjs
    skill/
      SKILL.md
```

Skill 也安装在这个写作目录里（项目级安装），这样只有在这个目录下工作时才会加载，不污染全局。

### 在 Claude Code 中安装

Claude Code 从工作目录的 `.claude/skills/<name>/SKILL.md` 加载项目级 Skill。在写作目录下建一个软链接指向项目自带的 skill 即可：

```bash
cd writing
mkdir -p .claude/skills
ln -s ../../md2media/skill/md2media .claude/skills/md2media
```

之后在写作目录里启动 `claude`，输入 `/md2media` 或直接说“把 article-a.md 转成公众号格式”，Skill 就会被触发。

> 软链接的好处：项目更新 skill 后无需重新安装，改动自动生效。若不便用软链接（如 Windows），把 `md2media/skill` 整个目录复制成 `.claude/skills` 也可以。

### 在 Codex 中安装

Codex 从 `.codex/skills/<name>/SKILL.md` 加载 Skill（项目级放工作目录下，全局级放 `~/.codex/skills/`）。项目自带的 `skill/agents/openai.yaml` 已提供 Codex 所需的入口定义。项目级安装同样用软链接：

```bash
cd writing
mkdir -p .codex/skills
ln -s ../../md2media/skill/md2media .codex/skills/md2media
```

想全局可用（在任意目录都能调用），则链接到用户级目录：

```bash
ln -s /path/to/writing/md2media/skill/md2media ~/.codex/skills/md2media
```

安装后，在对话里让 Codex“用 md2media 把某篇文章转成公众号 HTML”即可。

## 平台支持

| 平台 | 命令行一键复制 | 本地预览复制 |
| --- | --- | --- |
| macOS | ✅ 已验证（`osascript`） | ✅ |
| Windows | ⚠️ 已实现待验证（PowerShell） | ✅ |
| Linux 等 | ❌ 请用 `--stdout` | ✅ |

本地预览的复制走浏览器 `navigator.clipboard`，与平台无关，各系统通用。

命令行的一键复制目前只在 macOS 上实测通过。Windows 的实现走 PowerShell 的 `System.Windows.Forms.Clipboard`，把 HTML 包成 CF_HTML 格式写入剪贴板，代码逻辑和字节偏移已自测，但尚未在真实 Windows 环境验证粘贴效果。欢迎在 Windows 上跑一次 `node build.mjs 某篇.md` 后反馈是否能正常粘进公众号。

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
