#!/usr/bin/env node
// 年度主题的唯一来源：运行本文件会同步生成 108 份 CSS、日期注册表和色带预览。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const themesDir = path.dirname(fileURLToPath(import.meta.url));
const periods = [
  ['early', '上旬'],
  ['mid', '中旬'],
  ['late', '下旬'],
];
const phases = [
  ['opening', '初段'],
  ['core', '正段'],
  ['closing', '末段'],
];

// 每月三旬的展示主色、正文强调色和交接色均为人工确定的固定 HEX。
// 它既是 CSS 与 registry 的共同输入，也是避免两份映射漂移的唯一维护点。
const monthlyThemes = [
  ['frost-blue', [['#53788A', '#365D70', '#6F687E'], ['#426B7D', '#2F576A', '#685B78'], ['#486E82', '#315A6D', '#685B78']]],
  ['smoke-violet', [['#6E637E', '#50475F', '#814E68'], ['#685B78', '#4E425D', '#955260'], ['#725B76', '#523E59', '#955260']]],
  ['plum-rose', [['#8B5667', '#6D3D4C', '#8B5236'], ['#955260', '#743B49', '#8B5236'], ['#9A5B5D', '#763E43', '#8B5236']]],
  ['apricot', [['#A46F52', '#7A4B35', '#6D642D'], ['#A66B45', '#7D472C', '#4D6429'], ['#A26F42', '#783F26', '#4D6429']]],
  ['willow-green', [['#728244', '#56652E', '#356A4A'], ['#68813D', '#4D6429', '#2D7860'], ['#618142', '#49642B', '#2D7860']]],
  ['emerald', [['#3F7D62', '#245F49', '#268078'], ['#2D7860', '#1E5D48', '#147A83'], ['#28796A', '#1B5E52', '#147A83']]],
  ['celadon', [['#287D79', '#12635F', '#287A91'], ['#147A83', '#0D6068', '#3C6E99'], ['#197B87', '#0E606A', '#3C6E99']]],
  ['sea-blue', [['#4B7594', '#315A78', '#617780'], ['#3C6E99', '#285779', '#607478'], ['#486F90', '#305A77', '#607478']]],
  // 九月保留低饱和转季气质，但标题使用更深、更有色相的灰青—松绿，避免被黑色正文压住。
  ['dusk-sage', [['#3F7180', '#2B5862', '#49685B'], ['#356A6D', '#285457', '#52633F'], ['#526B4D', '#3C563C', '#666A35']]],
  ['olive-gold', [['#7C793F', '#625E29', '#9A6936'], ['#77733B', '#5D5926', '#93482F'], ['#7F7139', '#625425', '#93482F']]],
  ['maple-rust', [['#964F35', '#74351F', '#795162'], ['#93482F', '#71321D', '#505275'], ['#884833', '#69301F', '#505275']]],
  ['indigo-violet', [['#5B5875', '#413F5B', '#4A6C7D'], ['#505275', '#393B59', '#426B7D'], ['#4D5974', '#384658', '#426B7D']]],
];

const seasonals = {
  winter: { months: [12, 1, 2], text: '#303943', heading: '#1E2935', muted: '#66727E', quoteBg: '#F4F7F9', inlineBg: '#EAF1F5', tableBg: '#EAF0F4', border: '#C9D6DE', codeBg: '#192838', codeText: '#D9E5ED', syntax: ['#8FA7B8', '#8ED0E8', '#A9D69A', '#E5C78A', '#85B8E6', '#D6D38E', '#E7A5B0', '#8DDBC9'] },
  spring: { months: [3, 4, 5], text: '#3D3B35', heading: '#2B2924', muted: '#756F63', quoteBg: '#FBF8F1', inlineBg: '#F7F0E5', tableBg: '#F6F0E4', border: '#DDD1BE', codeBg: '#243B36', codeText: '#DDE9E1', syntax: ['#93AAA0', '#8FD2B3', '#C2D990', '#E5C789', '#8AC7B8', '#D8D28C', '#E8A6AD', '#8ED2C2'] },
  summer: { months: [6, 7, 8], text: '#2F3F46', heading: '#16323A', muted: '#61747A', quoteBg: '#F0FAFB', inlineBg: '#E7F6F7', tableBg: '#E8F6F7', border: '#C6E0E2', codeBg: '#183B43', codeText: '#D8ECEE', syntax: ['#8DA8AC', '#8ED8E3', '#A7D99B', '#E5C889', '#82C5ED', '#D8D58F', '#E6A4AD', '#8CD9CA'] },
  autumn: { months: [9, 10, 11], text: '#403A34', heading: '#2D2924', muted: '#766B60', quoteBg: '#FBF7EF', inlineBg: '#F7F0E3', tableBg: '#F5EEDF', border: '#DDCFBA', codeBg: '#352A25', codeText: '#EEE0D2', syntax: ['#AA998C', '#E0B17C', '#B8D08A', '#E4C17F', '#8BC4C3', '#D8CF8D', '#E3A09B', '#8ECBBF'] },
};

function seasonFor(month) {
  return Object.values(seasonals).find((s) => s.months.includes(month));
}

// 浅表面色只从当前旬已定稿的主/交接色派生；生成结果仍全部是固定 HEX。
function mixWithWhite(hex, whiteRatio) {
  const channels = hex.match(/[\da-f]{2}/gi).map((value) => Number.parseInt(value, 16));
  return `#${channels.map((value) => Math.round(value * (1 - whiteRatio) + 255 * whiteRatio).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function decorateColors(colors) {
  return {
    ...colors,
    quoteBg: mixWithWhite(colors.secondary, 0.94),
    inlineBg: mixWithWhite(colors.display, 0.90),
    tableBg: mixWithWhite(colors.secondary, 0.89),
    border: mixWithWhite(colors.secondary, 0.72),
  };
}

// 相邻锚点之间采用 OKLab 感知空间插值，避免 RGB/HSL 过渡中常见的灰脏和亮度跳变。
function hexToOklab(hex) {
  const [r, g, b] = hex.match(/[\da-f]{2}/gi)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const [lc, mc, sc] = [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)];
  return [
    0.2104542553 * lc + 0.793617785 * mc - 0.0040720468 * sc,
    1.9779984951 * lc - 2.428592205 * mc + 0.4505937099 * sc,
    0.0259040371 * lc + 0.7827717662 * mc - 0.808675766 * sc,
  ];
}

function oklabToHex([l, a, b]) {
  const lc = l + 0.3963377774 * a + 0.2158037573 * b;
  const mc = l - 0.1055613458 * a - 0.0638541728 * b;
  const sc = l - 0.0894841775 * a - 1.291485548 * b;
  const [ll, mm, ss] = [lc ** 3, mc ** 3, sc ** 3];
  const linear = [
    4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss,
  ];
  return `#${linear.map((value) => {
    const clamped = Math.max(0, Math.min(1, value));
    const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255).toString(16).padStart(2, '0');
  }).join('')}`.toUpperCase();
}

function mixOklab(from, to, ratio) {
  const a = hexToOklab(from);
  const b = hexToOklab(to);
  return oklabToHex(a.map((value, index) => value + (b[index] - value) * ratio));
}

function mixPalette(from, to, ratio) {
  return decorateColors({
    display: mixOklab(from.display, to.display, ratio),
    text: mixOklab(from.text, to.text, ratio),
    secondary: mixOklab(from.secondary, to.secondary, ratio),
  });
}

function cssFor(theme, colors, seasonal) {
  const [comment, keyword, string, number, title, type, variable, builtin] = seasonal.syntax;
  return `/* ${theme}: 年度四季主题。由 generate-seasonal-themes.mjs 生成，请勿手工编辑。 */
#nice { font-size:16px; color:${seasonal.text}; line-height:1.5; letter-spacing:0; word-spacing:0; font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif; word-break:break-word; }
#nice p { margin:0; padding:8px 0; font-size:16px; color:${seasonal.text}; line-height:1.8; letter-spacing:.04em; }
#nice h1 { margin:30px 0 15px; font-size:24px; font-weight:bold; text-align:center; color:${colors.display}; line-height:1.5; }
#nice h2 { margin:30px 0 15px; padding-left:12px; font-size:20px; font-weight:bold; color:${colors.display}; border-left:4px solid ${colors.display}; line-height:1.5; }
#nice h3 { margin:30px 0 15px; font-size:17px; font-weight:bold; color:${colors.display}; line-height:1.5; }
#nice h4 { margin:30px 0 15px; font-size:16px; font-weight:bold; color:${seasonal.heading}; line-height:1.5; }
#nice h5 { margin:30px 0 15px; font-size:15px; font-weight:bold; color:${seasonal.heading}; line-height:1.5; }
#nice h6 { margin:30px 0 15px; font-size:14px; font-weight:bold; color:${seasonal.heading}; line-height:1.5; }
#nice blockquote { margin:20px 0; padding:10px 20px; border-left:3px solid ${colors.secondary}; background:${colors.quoteBg}; color:${seasonal.muted}; font-size:15px; }
#nice blockquote p { margin:0; padding:8px 0; color:${seasonal.muted}; }
#nice blockquote p + p { margin-top:15px; }
#nice ul, #nice ol { margin:8px 0; padding-left:25px; color:${seasonal.text}; }
#nice li { margin:5px 0; line-height:1.8; letter-spacing:.04em; }
#nice p code, #nice li code, #nice h2 code, #nice h3 code { margin:0 2px; padding:2px 6px; font-size:14px; color:${colors.text}; background:${colors.inlineBg}; border-radius:4px; font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace; }
#nice pre { margin:20px 8px; padding:16px; overflow-x:auto; background:${seasonal.codeBg}; border-radius:8px; font-size:13px; line-height:1.6; }
#nice pre code { padding:0; color:${seasonal.codeText}; background:transparent; font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace; }
#nice table { margin:20px auto; border-collapse:collapse; font-size:14px; width:auto; }
#nice th, #nice td { padding:8px 14px; border:1px solid ${colors.border}; }
#nice th { background:${colors.tableBg}; font-weight:bold; color:${seasonal.heading}; }
#nice a { color:${colors.secondary}; text-decoration:none; border-bottom:1px solid ${colors.secondary}; }
#nice strong { color:${colors.text}; font-weight:bold; }
#nice em { font-style:italic; color:${colors.text}; }
#nice del { text-decoration:line-through; color:${seasonal.muted}; }
#nice hr { margin:32px 0; border:none; border-top:1px solid ${colors.border}; }
#nice img { max-width:100%; border-radius:6px; display:block; margin:20px auto; }
#nice .hljs-comment, #nice .hljs-quote { color:${comment}; font-style:italic; }
#nice .hljs-keyword, #nice .hljs-selector-tag { color:${keyword}; }
#nice .hljs-string, #nice .hljs-attr { color:${string}; }
#nice .hljs-number, #nice .hljs-literal { color:${number}; }
#nice .hljs-title, #nice .hljs-title.function_, #nice .hljs-section { color:${title}; }
#nice .hljs-type, #nice .hljs-class .hljs-title { color:${type}; }
#nice .hljs-variable, #nice .hljs-template-variable { color:${variable}; }
#nice .hljs-built_in, #nice .hljs-builtin-name { color:${builtin}; }
`;
}

function anchorThemes() {
  return monthlyThemes.flatMap(([slug, variants], monthIndex) => {
    const month = monthIndex + 1;
    const seasonal = seasonFor(month);
    return variants.map(([display, text, secondary], i) => {
      const [period, periodLabel] = periods[i];
      return { theme: `seasonal-${String(month).padStart(2, '0')}-${period}-${slug}`, slug, month, period, periodLabel, colors: decorateColors({ display, text, secondary }), seasonal };
    });
  });
}

function allThemes() {
  const anchors = anchorThemes();
  return anchors.flatMap((anchor, index) => {
    const previous = anchors[(index - 1 + anchors.length) % anchors.length];
    const next = anchors[(index + 1) % anchors.length];
    return phases.map(([phase, phaseLabel], phaseIndex) => {
      const colors = phase === 'opening'
        ? mixPalette(previous.colors, anchor.colors, 2 / 3)
        : phase === 'closing'
          ? mixPalette(anchor.colors, next.colors, 1 / 3)
          : anchor.colors;
      const theme = phase === 'core'
        ? anchor.theme
        : `seasonal-${String(anchor.month).padStart(2, '0')}-${anchor.period}-${phase}-${anchor.slug}`;
      return {
        theme,
        month: anchor.month,
        period: anchor.period,
        periodLabel: anchor.periodLabel,
        phase,
        phaseLabel,
        segmentLabel: `${anchor.periodLabel}·${phaseLabel}`,
        phaseIndex,
        colors,
        seasonal: anchor.seasonal,
      };
    });
  });
}

function registryFor(themes) {
  const schedule = themes.map(({ seasonal, colors, ...entry }) => entry);
  return `// 由 generate-seasonal-themes.mjs 生成，请勿手工编辑。\nexport const seasonalThemeSchedule = ${JSON.stringify(schedule, null, 2)};\n\nfunction rangesForPeriod(period, lastDay) {\n  if (period === 'early') return [[1, 3], [4, 7], [8, 10]];\n  if (period === 'mid') return [[11, 13], [14, 17], [18, 20]];\n  const length = lastDay - 20;\n  const firstEnd = 20 + Math.round(length / 3);\n  const secondEnd = 20 + Math.round(length * 2 / 3);\n  return [[21, firstEnd], [firstEnd + 1, secondEnd], [secondEnd + 1, lastDay]];\n}\n\nexport function resolveSeasonalTheme(date = new Date()) {\n  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('日期必须是有效的 Date 对象');\n  const month = date.getMonth() + 1;\n  const day = date.getDate();\n  const period = day <= 10 ? 'early' : day <= 20 ? 'mid' : 'late';\n  const lastDay = new Date(date.getFullYear(), month, 0).getDate();\n  const ranges = rangesForPeriod(period, lastDay);\n  const phaseIndex = ranges.findIndex(([start, end]) => day >= start && day <= end);\n  const result = seasonalThemeSchedule.find((item) => item.month === month && item.period === period && item.phaseIndex === phaseIndex);\n  if (!result) throw new Error(\`未找到季节主题：\${month} 月\${period} 第 \${phaseIndex + 1} 段\`);\n  const [startDay, endDay] = ranges[phaseIndex];\n  return { ...result, startDay, endDay };\n}\n`;
}

function previewFor(themes) {
  const cards = themes.map((t) => `<article><i style="background:${t.colors.display}"></i><b>${t.theme}</b><span>${t.month} 月${t.segmentLabel} · ${t.colors.display} → ${t.colors.secondary}</span></article>`).join('');
  const stripe = themes.map((t) => `<i title="${t.theme}" style="background:${t.colors.display}"></i>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>年度四季主题色带</title><style>body{margin:32px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#263238}h1{font-size:24px}.stripe{display:flex;height:42px;border-radius:8px;overflow:hidden}.stripe i{flex:1}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:24px}article{border:1px solid #dde3e5;border-radius:8px;padding:12px}article i{display:block;height:18px;border-radius:4px;margin-bottom:8px}b,span{display:block}span{color:#66757a;font-size:12px}</style><h1>年度四季主题：108 色连续色带</h1><p>由 <code>generate-seasonal-themes.mjs</code> 自动生成；每格代表约 3—4 天的主题切片。</p><div class="stripe">${stripe}</div><div class="grid">${cards}</div>`;
}

function validate(themes) {
  if (themes.length !== 108) throw new Error(`主题数量应为 108，实际为 ${themes.length}`);
  const names = new Set(themes.map((t) => t.theme));
  if (names.size !== 108) throw new Error('主题名称重复');
  for (let month = 1; month <= 12; month++) {
    const entries = themes.filter((t) => t.month === month);
    if (entries.length !== 9) throw new Error(`${month} 月应有 9 个主题，实际为 ${entries.length}`);
    for (const [period] of periods) {
      if (entries.filter((t) => t.period === period).map((t) => t.phase).join(',') !== 'opening,core,closing') throw new Error(`${month} 月 ${period} 映射不完整`);
    }
  }
}

const themes = allThemes();
validate(themes);
for (const entry of themes) fs.writeFileSync(path.join(themesDir, `${entry.theme}.css`), cssFor(entry.theme, entry.colors, entry.seasonal));
fs.writeFileSync(path.join(themesDir, 'seasonal-theme-registry.mjs'), registryFor(themes));
fs.writeFileSync(path.join(themesDir, 'seasonal-palette-preview.html'), previewFor(themes));
const generated = fs.readdirSync(themesDir).filter((file) => /^seasonal-\d{2}-(early|mid|late)-.+\.css$/.test(file));
if (generated.length !== 108 || themes.some((t) => !generated.includes(`${t.theme}.css`))) throw new Error('生成后 CSS 与日期映射不一致');
console.log(`已生成 ${themes.length} 套年度主题、日期注册表和色带预览。`);
