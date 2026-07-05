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

// macOS: 把 HTML 作为富文本写入剪贴板，粘贴进公众号即带样式。
// 走 osascript，set the clipboard to «class HTML»...，比 pbcopy 纯文本更可靠。
function copyHtmlToClipboard(html) {
  // 把 HTML 转成 hex，交给 AppleScript 以 HTML 类型写入剪贴板
  const hex = Buffer.from(html, 'utf8').toString('hex');
  const script = `set the clipboard to «data HTML${hex}»`;
  const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8' });
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

  if (process.platform !== 'darwin') {
    console.error('默认复制富文本目前只支持 macOS。其他系统请使用 --stdout 输出 HTML。');
    process.exit(1);
  }
  if (copyHtmlToClipboard(html)) {
    console.log(`已复制到剪贴板（富文本）。\n主题: ${args.theme}\n可直接粘贴进公众号编辑器。`);
  } else {
    console.error('复制失败。可加 --stdout 输出 HTML，或使用本地预览服务复制。');
    process.exit(1);
  }
}

main();
