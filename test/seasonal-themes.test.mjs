import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseArgs, selectTheme } from '../build.mjs';
import { resolveSeasonalTheme, seasonalThemeSchedule } from '../themes/seasonal-theme-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themesDir = path.join(root, 'themes');
const date = (year, month, day) => new Date(year, month - 1, day, 12);
const luminance = (hex) => hex.match(/[\da-f]{2}/gi)
  .map((value) => Number.parseInt(value, 16) / 255)
  .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};
const channelSpread = (hex) => {
  const channels = hex.match(/[\da-f]{2}/gi).map((value) => Number.parseInt(value, 16));
  return Math.max(...channels) - Math.min(...channels);
};

test('年度主题清单完整、有序且所有 CSS 存在', () => {
  assert.equal(seasonalThemeSchedule.length, 108);
  assert.deepEqual([...new Set(seasonalThemeSchedule.map((item) => item.theme))].length, 108);
  for (let month = 1; month <= 12; month++) {
    const entries = seasonalThemeSchedule.filter((item) => item.month === month);
    assert.equal(entries.length, 9);
    for (const period of ['early', 'mid', 'late']) {
      assert.deepEqual(entries.filter((item) => item.period === period).map((item) => item.phase), ['opening', 'core', 'closing']);
    }
  }
  const generated = fs.readdirSync(themesDir).filter((file) => /^seasonal-\d{2}-(early|mid|late)-.+\.css$/.test(file));
  assert.equal(generated.length, 108);
  for (const item of seasonalThemeSchedule) assert.equal(fs.existsSync(path.join(themesDir, `${item.theme}.css`)), true, item.theme);
  assert.equal(seasonalThemeSchedule.filter((item) => item.phase === 'core' && !/(opening|closing)/.test(item.theme)).length, 36, '36 个旧锚点名称应保持兼容');
});

test('日期旬与段边界、闰年解析正确', () => {
  for (const [month, day, period, phase] of [
    [1, 1, 'early', 'opening'], [1, 3, 'early', 'opening'],
    [1, 4, 'early', 'core'], [1, 7, 'early', 'core'], [1, 8, 'early', 'closing'], [1, 10, 'early', 'closing'],
    [1, 11, 'mid', 'opening'], [1, 14, 'mid', 'core'], [1, 18, 'mid', 'closing'], [1, 20, 'mid', 'closing'],
    [1, 21, 'late', 'opening'], [1, 25, 'late', 'core'], [1, 28, 'late', 'closing'], [1, 31, 'late', 'closing'],
    [2, 28, 'late', 'closing'], [2, 29, 'late', 'closing'], [12, 31, 'late', 'closing'],
  ]) {
    const result = resolveSeasonalTheme(date(month === 2 && day === 29 ? 2024 : 2025, month, day));
    assert.equal(result.month, month);
    assert.equal(result.period, period);
    assert.equal(result.phase, phase);
  }
  assert.equal(resolveSeasonalTheme(date(2024, 2, 29)).endDay, 29);
  assert.equal(resolveSeasonalTheme(date(2025, 2, 28)).endDay, 28);
});

test('手动主题覆盖自动选择，自动缺失 CSS 会失败', () => {
  const manual = selectTheme(parseArgs(['-t', 'summer-breeze']), date(2025, 7, 16), []);
  assert.deepEqual(manual, { theme: 'summer-breeze', mode: 'manual', detail: '手动（--theme）' });
  const automatic = selectTheme(parseArgs([]), date(2025, 7, 16), ['seasonal-07-mid-celadon']);
  assert.equal(automatic.theme, 'seasonal-07-mid-celadon');
  assert.equal(automatic.detail, '自动（7 月中旬·正段，14—17 日）');
  assert.throws(() => selectTheme(parseArgs([]), date(2025, 7, 16), []), /自动主题缺少 CSS.*seasonal-07-mid-celadon/);
});

test('主题普通文字颜色符合 4.5:1 对比度目标', () => {
  const uniquePalettes = new Set();
  for (const item of seasonalThemeSchedule) {
    const css = fs.readFileSync(path.join(themesDir, `${item.theme}.css`), 'utf8');
    uniquePalettes.add(css.replace(item.theme, '<theme>'));
    const link = css.match(/#nice a \{ color:(#[\dA-F]+);/)[1];
    const code = css.match(/#nice p code[^\n]+color:(#[\dA-F]+); background:(#[\dA-F]+)/);
    assert.ok(contrast(link, '#FFFFFF') >= 4.5, `${item.theme} 的链接对比度不足`);
    assert.ok(contrast(code[1], code[2]) >= 4.5, `${item.theme} 的行内代码对比度不足`);
  }
  assert.equal(uniquePalettes.size, 108, '108 套主题应具有不同的完整色板');
});

test('九月标题保持灰青至松绿的明确视觉层级', () => {
  for (const item of seasonalThemeSchedule.filter((entry) => entry.month === 9)) {
    const css = fs.readFileSync(path.join(themesDir, `${item.theme}.css`), 'utf8');
    const title = css.match(/#nice h1 \{[^\n]+color:(#[\dA-F]+);/)[1];
    assert.ok(contrast(title, '#FFFFFF') >= 4.5, `${item.theme} 的标题对比度不足`);
    assert.ok(channelSpread(title) >= 28, `${item.theme} 的标题色过于中性灰`);
  }
});
