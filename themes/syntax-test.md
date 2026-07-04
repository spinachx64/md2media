# 一级标题 H1（文章主标题）

这是引言段落，用来测试正文的基本排版：字号、行高、字间距。中英文混排 Markdown and 微信公众号 排版效果，看看 letter-spacing 和 line-height 是否舒服。这里再补一句长文本，让段落自动折行，观察 word-break 的表现是否正常，不要出现英文单词 supercalifragilisticexpialidocious 中间乱断的情况。

## 二级标题 H2（章节标题）

二级标题下的第一段。测试标题与正文之间的间距是否协调。

### 三级标题 H3（小节标题）

三级标题下的段落。测试 H3 的颜色和字号层级是否和 H1/H2 拉开。

#### 四级标题 H4

四级标题（很多主题不单独设计，观察是否有降级样式）。

##### 五级标题 H5

###### 六级标题 H6

## 行内文本样式

这一段集中测试行内样式：**加粗文本**、*斜体文本*、***加粗斜体***、~~删除线~~、`行内代码 inline code`、以及 [一个超链接](https://example.com)。

再测试组合：**加粗里包含 `行内代码`**、*斜体里包含 [链接](https://example.com)*、以及一句话里 **连续** *多种* ~~样式~~ `混排` 的疏密效果。

中文标点测试：“中文双引号”、‘单引号’、（圆括号）、【方括号】、《书名号》、破折号——以及省略号……

## 无序列表

- 第一项，普通文本
- 第二项，带 **加粗** 和 `行内代码`
- 第三项，带 [链接](https://example.com)
- 第四项，一段较长的文本，用来测试列表项在换行之后的缩进对齐是否正确，第二行应该和第一行文字对齐，而不是顶到 bullet 下面

## 有序列表

1. 第一步：初始化项目
2. 第二步：安装依赖
3. 第三步：运行构建
4. 第四步：验证输出

## 嵌套列表

- 一级项目 A
  - 二级项目 A-1
  - 二级项目 A-2
    - 三级项目 A-2-a
    - 三级项目 A-2-b
- 一级项目 B
  1. 二级有序 B-1
  2. 二级有序 B-2

## 任务列表

- [x] 已完成的任务
- [ ] 未完成的任务
- [ ] 另一个待办事项

## 引用块

> 这是一段单行引用。测试引用块的左边框、背景色和文字颜色。

> 这是多行引用的第一行。
> 这是第二行，观察换行是否保留。
>
> 空行之后的新段落。

> 引用里包含 **加粗**、`行内代码` 和 [链接](https://example.com)，测试嵌套样式。

多级引用：

> 第一级引用
>> 第二级引用（嵌套）
>>> 第三级引用

## 行内代码密度测试

安装命令用 `npm install`，配置文件是 `package.json`，运行 `node build.mjs ../mcp3.md` 即可。一句话里出现 `a`、`b`、`c` 多个短代码，看间距是否拥挤。

## 代码块（纯文本）

```text
这是纯文本代码块
第二行，测试换行是否保留
    这一行行首有 4 个空格缩进，测试缩进是否保留
连续    空格    测试    对齐
```

## 代码块（bash，带高亮）

```bash
# 注释行
claude mcp add demo -- /usr/bin/python3 /data/mcp.py

# 带参数的例子
claude mcp add demo -- /usr/bin/python3 /data/mcp.py --port 9000
echo "hello world"
```

## 代码块（python）

```python
def fibonacci(n):
    """计算斐波那契数列"""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print(fibonacci(10))  # 输出 55
```

## 代码块（json）

```json
{
  "mcpServers": {
    "demo": {
      "command": "/usr/bin/python3",
      "args": ["/data/mcp.py"],
      "env": {
        "FOO": "bar"
      }
    }
  }
}
```

## 代码块（javascript）

```javascript
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const nums = [1, 2, 3, 4, 5];
console.log(`总和是 ${sum(nums)}`);
```

## 表格（基础）

| 操作 | Claude Code | Codex |
| --- | --- | --- |
| 添加 stdio | `claude mcp add demo` | `codex mcp add demo` |
| 查看列表 | `claude mcp list` | `codex mcp list` |
| 删除 | `claude mcp remove demo` | `codex mcp remove demo` |

## 表格（对齐方式）

| 左对齐 | 居中对齐 | 右对齐 |
| :--- | :---: | ---: |
| 短 | 中间 | 数字 100 |
| 较长的内容测试 | 居中 | 3.14 |

## 分割线

上面的内容。

---

下面的内容（测试分割线的样式和上下间距）。

## 链接与图片

一个 [普通链接](https://example.com)，一个 [带标题的链接](https://example.com "悬停标题")。

图片测试（占位图）：

## 长段落收尾

最后用一个长段落收尾，混合各种元素做整体观感检查。我们做了一个本地排版工具，用 `marked` 把 Markdown 转成 HTML，再用 `juice` 把 CSS **全部内联**，因为微信公众号编辑器*只认内联样式*。代码块换行是最大的坑——[详见相关文章](https://example.com)。整体流程走下来，和 mdnice 的差距主要在细节打磨上，比如 ~~一度以为~~ 现在逐项追平的这些语法点。
