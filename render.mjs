// 核心渲染模块：Markdown → 套主题 CSS → juice 内联样式 → 微信可粘贴的 HTML
// CLI(build.mjs) 和预览页(serve.mjs) 都调用这里，保证两边输出完全一致。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import juice from 'juice';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = path.join(__dirname, 'themes');

// 列出 themes/ 下所有可用主题（文件名去掉 .css）
export function listThemes() {
  if (!fs.existsSync(THEMES_DIR)) return [];
  return fs
    .readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => f.replace(/\.css$/, ''))
    .sort();
}

// 提取主题主色调：取 #nice h1 的 color 作为代表色，供预览页色块展示。
// 拿不到就退回一个中性灰，保证前端一定有颜色可渲染。
export function themeColor(name) {
  try {
    const css = readTheme(name);
    const m = css.match(/#nice\s+h1\s*\{[^}]*?color:\s*(#[0-9a-fA-F]{3,8}|rg[ab]?\([^)]+\))/);
    if (m) return m[1];
  } catch {}
  return '#888888';
}

// 列出所有主题及其主色调，供预览页色块平铺展示。
export function listThemesWithColor() {
  return listThemes().map((name) => ({ name, color: themeColor(name) }));
}

export function readTheme(name) {
  const file = path.join(THEMES_DIR, `${name}.css`);
  if (!fs.existsSync(file)) {
    const avail = listThemes().join(', ') || '（themes/ 下暂无主题）';
    throw new Error(`找不到主题 "${name}"。可用主题：${avail}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function normalizeStrongDelimiterBoundaries(markdown) {
  const normalizeText = (text) =>
    text
      .replace(/(\*\*[^*\n]+?[：:])\s+\*\*(?=\s)/g, '$1**')
      .replace(/(\*\*[^*\n]+?[：:])\s+\*\*(?=[^\s\r\n])/g, '$1**&zwnj;')
      .replace(/(\*\*[^*\n]+?[：:]\*\*)(?=[^\s\r\n])/g, '$1&zwnj;');

  return markdown
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
    .map((block, i) => {
      if (i % 2 === 1) return block;
      return block
        .split(/(`+[^`\n]*?`+)/g)
        .map((part, j) => (j % 2 === 1 ? part : normalizeText(part)))
        .join('');
    })
    .join('');
}

// 每次渲染新建实例，避免多次调用间状态污染
function buildMarked() {
  const marked = new Marked(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
    })
  );
  marked.setOptions({ gfm: true, breaks: true });

  // 正文里写的字面标签（<br>、<style>、<script> 等）会被当行内 HTML 原样透传，
  // 之后要么被 juice 当真标签处理（<style> 吞正文、<br> 变真换行），要么原样出现在
  // 公众号里。marked 在 token 层其实分得清：软换行是 br token，字面标签是 html token。
  // 这里只重写行内 html renderer 做转义，软换行走的是另一条 renderer 路径，仍是真换行。
  marked.use({
    renderer: {
      html(token) {
        const raw = typeof token === 'string' ? token : token.text;
        return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      },
    },
  });
  return marked;
}

// 微信粘贴清洗器会把 <pre> 里的换行、空格压掉，还会把 <code> 里的 <br> 删掉——
// 靠 <br> 换行不可靠（试过全删）。这里改成不依赖 <br>：把每一行代码包成一个
// 块级元素 <span style="display:block">。块级元素天然独占一行，微信没有理由把
// 两个 block 合并，所以换行一定保住。行内空格仍转 &nbsp;，保证缩进和对齐不被折叠。
// 只处理标签之外的文本，不碰 hljs 高亮的 <span>。
//
// 关键：只处理块级代码块（<pre> 里的 <code>）。行内代码（正文里的 `x`）是段落中
// 的裸 <code>，不在 <pre> 里，绝不能加 block span 或转空格——否则会强制换行、
// 把正文撑断。所以正则整体匹配 <pre>...<code>...</code>...</pre>。
function preserveCodeWhitespace(html) {
  return html.replace(
    /(<pre\b[^>]*>[\s\S]*?<code\b[^>]*>)([\s\S]*?)(<\/code>[\s\S]*?<\/pre>)/g,
    (m, open, code, close) => {
      const lines = code.replace(/\n$/, '').split('\n');
      const wrapped = lines
        .map((line) => {
          const converted = line
            .split(/(<[^>]*>)/) // 偶数段=文本，奇数段=标签
            // 换行已由 display:block 的 block span 保证，不再靠 &nbsp; 防折叠。
            // 只把行首缩进和连续空格(2+)转 &nbsp; 保对齐；单个词间空格保留普通空格，
            // 否则每个空格都变硬空格会让字距过大。
            .map((seg, i) =>
              i % 2 === 1 ? seg : seg.replace(/^ +| {2,}/g, (s) => '&nbsp;'.repeat(s.length))
            )
            .join('');
          // 空行也要撑出一行高度，给一个 &nbsp;
          return `<span style="display:block">${converted || '&nbsp;'}</span>`;
        })
        .join('');
      return open + wrapped + close;
    }
  );
}

// 任务列表：marked 生成 <input type="checkbox">，但微信粘贴会清洗掉 input 标签，
// 勾选框直接消失。这里把它换成 emoji 文本（✅/⬜），微信不会动纯文本。
function replaceTaskCheckboxes(html) {
  return html
    .replace(/<input[^>]*\bchecked\b[^>]*type="checkbox"[^>]*>/g, '✅ ')
    .replace(/<input[^>]*type="checkbox"[^>]*\bchecked\b[^>]*>/g, '✅ ')
    .replace(/<input[^>]*type="checkbox"[^>]*>/g, '⬜ ');
}

// 表格对齐：marked 把 :---: 之类的对齐写进 <th>/<td> 的 align 属性（align="center"），
// 微信不认 align 属性，只认内联 text-align。在 juice 之前处理 marked 的原始输出——
// 此时单元格只有 align 属性、还没有 style，格式干净可预测，直接把 align="x" 换成
// style="text-align:x"。juice 随后会把 CSS 里的 padding/border 等合并进这条 style。
function inlineTableAlign(html) {
  return html.replace(
    /(<t[dh])\s+align="(left|center|right)"/g,
    (m, tag, align) => `${tag} style="text-align: ${align};"`
  );
}

// 公众号后台粘贴时，容易把 <li><strong>标题</strong>：正文</li> 这种
// “行内标签 + 裸文本”结构拆成两块，并把后半段包进块级 <section>，导致换行。
// mdnice 的做法是让列表项内容整体位于同一个 section 里，这样 strong 和后续文本
// 会作为同一个内容块进入公众号编辑器。
function wrapListItemSectionContent(html) {
  return html.replace(/(<li\b[^>]*>)([\s\S]*?)(<\/li>)/g, (m, open, content, close) => {
    if (/<(?:ul|ol|section|p|blockquote|pre|table|h[1-6])\b/i.test(content)) return m;
    return `${open}<section style="margin: 0; line-height: 1.80;">${content}</section>${close}`;
  });
}

// 微信不认 <style> 和 class，juice 把 CSS 全部内联到 style="" 上。
// 所有内容包一层 #nice，主题 CSS 也以 #nice 为作用域，避免污染。
export function render(markdown, themeName = 'mint-terminal') {
  const marked = buildMarked();
  let body = preserveCodeWhitespace(marked.parse(normalizeStrongDelimiterBoundaries(markdown)));
  body = body.replace(/&zwnj;/g, '');
  body = replaceTaskCheckboxes(body);
  body = inlineTableAlign(body); // juice 之前把表格 align 属性转成 text-align
  body = wrapListItemSectionContent(body);

  const css = readTheme(themeName);

  const html = `<section id="nice">${body}</section>`;
  const styled = `<style>${css}</style>${html}`;

  const inlined = juice(styled, {
    inlinePseudoElements: true, // 让 h2::before 这类装饰也能内联
    preserveImportant: true,
  });
  return inlined;
}

// 供预览页用：额外包一个可复制的完整文档外壳
export function renderPage(markdown, themeName) {
  const inlined = render(markdown, themeName);
  return inlined;
}
