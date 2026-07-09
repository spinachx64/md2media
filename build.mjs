#!/usr/bin/env node
// CLI: 把 Markdown 转成微信公众号可粘贴的 HTML
//
// 用法:
//   node build.mjs <input.md> [--theme <名字>] [--stdout]
//   node build.mjs --list                 列出所有可用主题
//
// 示例:
//   node build.mjs ../mcp3.md                       直接复制到剪贴板（macOS）
//   node build.mjs ../mcp3.md --theme summer-breeze
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { render, listThemes } from './render.mjs';

function parseArgs(argv) {
  const args = { _: [], theme: 'summer-breeze', stdout: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--theme': case '-t': args.theme = argv[++i]; break;
      case '--stdout': args.stdout = true; break;
      case '--copy': case '-c': break; // 兼容旧命令；复制现在是默认行为。
      case '--list': case '-l': args.list = true; break;
      case '--help': case '-h': args.help = true; break;
      default:
        if (a.startsWith('-')) { console.error(`未知参数: ${a}`); process.exit(1); }
        args._.push(a);
    }
  }
  return args;
}

const HELP = `md2media — 本地 Markdown → 微信公众号 HTML 排版工具

用法:
  node build.mjs <input.md> [选项]
  node build.mjs --list

选项:
  -t, --theme <名字>   指定主题（默认 summer-breeze）
  --stdout             输出到标准输出，不写入剪贴板
  -l, --list           列出所有可用主题
  -h, --help           显示帮助

示例:
  node build.mjs ../mcp3.md
  node build.mjs ../mcp3.md --theme summer-breeze
`;

// 从渲染后的 HTML 里抽出纯文本，供剪贴板的 text/plain 那一份用。
// 对应预览页的 $frame.innerText：块级元素之间要有换行，否则粘到记事本会连成一坨。
// 代码块每行是 <span style="display:block">，块级元素闭合和 <br> 都算换行。
function htmlToPlainText(html) {
  return html
    .replace(/<span\b[^>]*display:\s*block[^>]*>/gi, '\n') // 代码块每行独占一行
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/section>\s*(<\/li>)/gi, '$1') // 列表项内部 section 不额外制造空行
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|pre|section)>/gi, '\n') // 块级元素闭合后换行
    .replace(/<[^>]+>/g, '') // 去掉其余标签
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&') // &amp; 最后解，避免把上面解出来的 & 二次处理
    .replace(/\n{3,}/g, '\n\n') // 连续空行压到最多一个
    .replace(/[ \t]+\n/g, '\n') // 行尾空白清掉
    .trim();
}

// macOS: 把 HTML 作为富文本写入剪贴板，粘贴进公众号即带样式。
// 同时写入 text/plain 一份，这样也能粘进记事本等纯文本编辑器。
// 微信粘贴用 text/plain 判断原始换行、用 text/html 拿样式；只给一种会丢换行或粘不进。
// 走 osascript 一次性写入 «class HTML» 和 string 两种类型，比 pbcopy 纯文本更可靠。
function copyHtmlToClipboard(html) {
  const hex = Buffer.from(html, 'utf8').toString('hex');
  // AppleScript 字符串转义：反斜杠和双引号
  const plain = htmlToPlainText(html).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `set the clipboard to {«class HTML»:«data HTML${hex}», string:"${plain}"}`;
  const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8' });
  return r.status === 0;
}

// 把 HTML 包装成 Windows 剪贴板的 CF_HTML 格式。
// 头部的 StartHTML/EndHTML/StartFragment/EndFragment 都是相对文件开头的“字节”偏移，
// 中文按 UTF-8 算多字节，所以偏移必须用 Buffer.byteLength，不能用字符串长度。
// 先用固定 10 位占位符撑住头部长度，算完真实偏移再回填，避免回填改变头部长度导致偏移错位。
function buildCfHtml(html) {
  const enc = (s) => Buffer.byteLength(s, 'utf8');
  const pad = (n) => String(n).padStart(10, '0');
  const prefix = '<html><body><!--StartFragment-->';
  const suffix = '<!--EndFragment--></body></html>';

  let header =
    'Version:0.9\r\n' +
    'StartHTML:0000000000\r\n' +
    'EndHTML:0000000000\r\n' +
    'StartFragment:0000000000\r\n' +
    'EndFragment:0000000000\r\n';

  const headerLen = enc(header);
  const startFragment = headerLen + enc(prefix);
  const endFragment = startFragment + enc(html);
  const endHtml = endFragment + enc(suffix);

  header = header
    .replace('StartHTML:0000000000', 'StartHTML:' + pad(headerLen))
    .replace('EndHTML:0000000000', 'EndHTML:' + pad(endHtml))
    .replace('StartFragment:0000000000', 'StartFragment:' + pad(startFragment))
    .replace('EndFragment:0000000000', 'EndFragment:' + pad(endFragment));

  return header + prefix + html + suffix;
}

// Windows: 通过 PowerShell 的 System.Windows.Forms.DataObject 同时写入
// “HTML Format”（富文本，供公众号）和纯文本（供记事本等）两份，逻辑对应 macOS 版。
// CF_HTML 载荷和纯文本都先落到临时文件（UTF-8 无 BOM），PowerShell 只负责按 UTF-8
// 读文件再写剪贴板，这样彻底绕开命令行转义和编码问题（中文尤其敏感）。
// 剪贴板操作要求 STA 线程，故用 powershell.exe -Sta（Windows 自带 5.1）。
function copyHtmlToClipboardWindows(html) {
  const cfHtml = buildCfHtml(html);
  const plain = htmlToPlainText(html);
  const tmp = os.tmpdir();
  const htmlFile = path.join(tmp, `mdwx-${process.pid}.htmlfmt`);
  const textFile = path.join(tmp, `mdwx-${process.pid}.txt`);

  fs.writeFileSync(htmlFile, cfHtml, 'utf8');
  fs.writeFileSync(textFile, plain, 'utf8');

  // PowerShell 里用单引号包路径，把路径内的单引号转义成两个单引号。
  const esc = (p) => p.replace(/'/g, "''");
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    `$html = [System.IO.File]::ReadAllText('${esc(htmlFile)}', [System.Text.Encoding]::UTF8)`,
    `$text = [System.IO.File]::ReadAllText('${esc(textFile)}', [System.Text.Encoding]::UTF8)`,
    '$d = New-Object System.Windows.Forms.DataObject',
    '$d.SetText($html, [System.Windows.Forms.TextDataFormat]::Html)',
    '$d.SetText($text, [System.Windows.Forms.TextDataFormat]::Text)',
    '[System.Windows.Forms.Clipboard]::SetDataObject($d, $true)',
  ].join('; ');

  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Sta', '-Command', script],
    { encoding: 'utf8' },
  );

  try { fs.unlinkSync(htmlFile); } catch {}
  try { fs.unlinkSync(textFile); } catch {}

  return r.status === 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) { console.log(HELP); return; }

  if (args.list) {
    const themes = listThemes();
    console.log('可用主题:');
    for (const t of themes) console.log(`  - ${t}`);
    return;
  }

  const input = args._[0];
  if (!input) { console.error('缺少输入文件。\n'); console.log(HELP); process.exit(1); }
  if (!fs.existsSync(input)) { console.error(`找不到文件: ${input}`); process.exit(1); }

  const markdown = fs.readFileSync(input, 'utf8');
  let html;
  try {
    html = render(markdown, args.theme);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  if (args.stdout) { process.stdout.write(html); return; }

  let ok;
  if (process.platform === 'darwin') {
    ok = copyHtmlToClipboard(html);
  } else if (process.platform === 'win32') {
    ok = copyHtmlToClipboardWindows(html);
  } else {
    console.error('默认复制富文本目前只支持 macOS 和 Windows。其他系统请使用 --stdout 输出 HTML，或用本地预览服务复制。');
    process.exit(1);
  }

  if (ok) {
    console.log(`已复制到剪贴板（富文本）。\n主题: ${args.theme}\n可直接粘贴进公众号编辑器。`);
  } else {
    console.error('复制失败。可加 --stdout 输出 HTML，或使用本地预览服务复制。');
    process.exit(1);
  }
}

main();
