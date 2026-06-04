import sharp from 'sharp';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'slides');
const WIDTH = 1672;
const HEIGHT = 941;

const font = 'Comic Sans MS, Chalkboard SE, Marker Felt, Arial Rounded MT Bold, sans-serif';
const mono = 'SFMono-Regular, Menlo, Consolas, monospace';

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgWrap(inner) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <marker id="arrow" markerWidth="16" markerHeight="16" refX="10" refY="8" orient="auto" markerUnits="strokeWidth">
      <path d="M2,2 L10,8 L2,14" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fbf3e6"/>
  ${inner}
</svg>`;
}

function textLines(lines, x, y, opts = {}) {
  const {
    size = 36,
    family = font,
    weight = 500,
    fill = '#111',
    anchor = 'middle',
    lineHeight = size * 1.28,
    style = '',
  } = opts;
  const spans = lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" style="${style}">${spans}</text>`;
}

function title(value, y = 92, size = 66) {
  return `
    ${textLines([value], WIDTH / 2, y, { size, weight: 800, style: 'letter-spacing: 0' })}
    <path d="M${WIDTH / 2 - 260},${y + 34} C${WIDTH / 2 - 120},${y + 48} ${WIDTH / 2 + 110},${y + 38} ${WIDTH / 2 + 260},${y + 44}" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
  `;
}

function box(x, y, w, h, lines, opts = {}) {
  const {
    fill = '#eef7df',
    stroke = '#111',
    size = 34,
    weight = 600,
    family = font,
    radius = 18,
    lineHeight = size * 1.22,
    textFill = '#111',
  } = opts;
  const total = (lines.length - 1) * lineHeight;
  const textY = y + h / 2 - total / 2 + size * 0.35;
  return `
    <rect x="${x + 9}" y="${y + 9}" width="${w}" height="${h}" rx="${radius}" fill="#111" opacity="0.95"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="5"/>
    ${textLines(lines, x + w / 2, textY, { size, weight, family, fill: textFill, lineHeight })}
  `;
}

function panel(x, y, w, h, label, labelFill = '#e9f4ff') {
  return `
    <rect x="${x + 11}" y="${y + 11}" width="${w}" height="${h}" rx="24" fill="#111"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="#fffdf8" stroke="#111" stroke-width="5"/>
    ${box(x + w * 0.18, y - 22, w * 0.64, 70, [label], { fill: labelFill, size: 31, radius: 16 })}
  `;
}

function arrow(x1, y1, x2, y2, opts = {}) {
  const { dash = false, width = 5 } = opts;
  return `<path d="M${x1},${y1} L${x2},${y2}" fill="none" stroke="#111" stroke-width="${width}" stroke-linecap="round" marker-end="url(#arrow)"${dash ? ' stroke-dasharray="10 12"' : ''}/>`;
}

function codeBlock(x, y, w, h, lines, opts = {}) {
  const { label = 'app.component.ts', size = 31 } = opts;
  const lineHeight = size * 1.55;
  const code = lines
    .map((line, index) => textLines([line], x + 32, y + 92 + index * lineHeight, {
      size,
      family: mono,
      anchor: 'start',
      weight: 500,
      fill: '#111',
    }))
    .join('');
  return `
    <rect x="${x + 11}" y="${y + 11}" width="${w}" height="${h}" rx="24" fill="#111"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="#fffdf8" stroke="#111" stroke-width="5"/>
    <path d="M${x},${y + 70} H${x + w}" stroke="#111" stroke-width="5"/>
    <circle cx="${x + 34}" cy="${y + 35}" r="14" fill="#ff9ca3" stroke="#111" stroke-width="4"/>
    <circle cx="${x + 72}" cy="${y + 35}" r="14" fill="#fff1a6" stroke="#111" stroke-width="4"/>
    <circle cx="${x + 110}" cy="${y + 35}" r="14" fill="#d7f6c7" stroke="#111" stroke-width="4"/>
    ${textLines([label], x + w - 34, y + 47, { size: 31, family: mono, anchor: 'end', weight: 700 })}
    ${code}
  `;
}

function bulletPanel(x, y, w, h, bullets, label = 'WHAT THIS MEANS', opts = {}) {
  const size = opts.size ?? 30;
  const rows = bullets
    .map((line, i) => {
      const cy = y + 105 + i * 92;
      return `
        <circle cx="${x + 56}" cy="${cy - 8}" r="24" fill="#ffd9d9" stroke="#111" stroke-width="4"/>
        <path d="M${x + 44},${cy - 9} L${x + 55},${cy + 4} L${x + 74},${cy - 21}" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        ${textLines([line], x + 96, cy, { size, anchor: 'start', weight: 600 })}
        ${i < bullets.length - 1 ? `<path d="M${x + 42},${cy + 38} H${x + w - 42}" stroke="#d5b98d" stroke-width="4" stroke-dasharray="12 12"/>` : ''}
      `;
    })
    .join('');
  return `
    <rect x="${x + 10}" y="${y + 10}" width="${w}" height="${h}" rx="24" fill="#111"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="#fffdf8" stroke="#111" stroke-width="5"/>
    ${box(x + 75, y - 22, w - 150, 70, [label], { fill: '#ffdcd8', size: 28, radius: 16 })}
    ${rows}
  `;
}

async function render(name, inner) {
  const svg = svgWrap(inner);
  await sharp(Buffer.from(svg)).png().toFile(join(OUT_DIR, `${name}.png`));
}

function zoneVsSignals() {
  const leftX = 110;
  const rightX = 870;
  const y = 188;
  const w = 610;
  const flowY = [300, 450, 600, 750];
  const leftLabels = [
    ['A callback finished'],
    ['Something may', 'have changed'],
    ['Angular checks', 'broadly'],
    ['One pass should', 'be stable'],
  ];
  const rightLabels = [
    ['A signal changed'],
    ['Angular knows', 'who consumed it'],
    ['Mark affected', 'views dirty'],
    ['Refresh affected', 'views'],
  ];
  return `
    ${title('ZONE.JS vs SIGNALS')}
    ${panel(leftX, y, w, 700, 'Zone.js model:', '#fff0c7')}
    ${panel(rightX, y, w, 700, 'Signal model:', '#eaf8d7')}
    ${leftLabels.map((lines, i) => box(leftX + 55, flowY[i], w - 110, 88, lines, { fill: ['#eef7df', '#e9f4ff', '#ffd8da', '#fff0c7'][i], size: i === 1 || i === 3 ? 31 : 33 })).join('')}
    ${rightLabels.map((lines, i) => box(rightX + 55, flowY[i], w - 110, 88, lines, { fill: ['#eef7df', '#e9f4ff', '#ffd8da', '#ead6ff'][i], size: i === 1 || i === 2 || i === 3 ? 31 : 33 })).join('')}
    ${flowY.slice(0, -1).map((fy) => arrow(leftX + w / 2, fy + 94, leftX + w / 2, fy + 135)).join('')}
    ${flowY.slice(0, -1).map((fy) => arrow(rightX + w / 2, fy + 94, rightX + w / 2, fy + 135)).join('')}
  `;
}

function reactiveGraph() {
  return `
    ${title('SIGNALS BUILD A REACTIVE GRAPH')}
    ${codeBlock(55, 180, 560, 255, [
      "name = signal('John');",
      '',
      'Template:',
      '{{ name() }}',
    ], { label: 'CODE + TEMPLATE', size: 32 })}
    ${panel(670, 190, 430, 650, 'REACTIVE GRAPH', '#ead6ff')}
    ${box(760, 290, 250, 120, ['name', 'producer', '"John"'], { fill: '#1f78e5', textFill: '#fff', size: 31, lineHeight: 35 })}
    ${arrow(885, 430, 885, 542, { dash: true, width: 4 })}
    ${box(735, 560, 300, 130, ['app-root', 'template consumer', '</>'], { fill: '#bfc0c0', size: 30, lineHeight: 36 })}
    ${bulletPanel(1165, 190, 455, 650, [
      'name is producer',
      'app-root is consumer',
      'name() creates edge',
      'name -> app-root',
      'affected view is known',
    ], 'WHAT THIS MEANS', { size: 25 })}
  `;
}

function templateConsumer() {
  const x = 260;
  const y = 175;
  const w = 1120;
  const ys = [205, 330, 455, 580, 705];
  return `
    ${title('TEMPLATES RUN WITH A REACTIVE CONSUMER', 82, 52)}
    ${panel(160, 170, 1350, 740, 'INSIDE VIEW REFRESH', '#e9f4ff')}
    ${box(x, ys[0], w, 80, ['refreshView(lView)'], { fill: '#e9f4ff', size: 33, family: mono })}
    ${box(x, ys[1], w, 80, ['ReactiveLViewConsumer'], { fill: '#eaf8d7', size: 33, family: mono })}
    ${box(x, ys[2], w, 80, ['executeTemplate(...)'], { fill: '#fff0c7', size: 33, family: mono })}
    ${box(x, ys[3], w, 80, ['template reads name()'], { fill: '#ffd8da', size: 33 })}
    ${box(x, ys[4], w, 80, ['producerAccessed(name)'], { fill: '#ead6ff', size: 33, family: mono })}
    ${ys.slice(0, -1).map((yy) => arrow(x + w / 2, yy + 88, x + w / 2, yy + 118)).join('')}
    ${box(390, 825, 840, 70, ['edge recorded:  name -> app-root template consumer'], { fill: '#fffdf8', size: 28, family: mono })}
  `;
}

function pushPull() {
  const leftX = 155;
  const rightX = 865;
  return `
    ${title('PUSH DIRTINESS, PULL VALUES')}
    ${panel(leftX, 165, 620, 750, 'FLOW', '#e9f4ff')}
    ${box(leftX + 95, 230, 430, 78, ["name.set('Doe')"], { fill: '#eaf8d7', size: 32, family: mono })}
    ${arrow(leftX + 310, 318, leftX + 310, 370)}
    ${box(leftX + 70, 382, 480, 110, ['PUSH:', 'mark app-root template', 'consumer dirty'], { fill: '#ffd8da', size: 31, lineHeight: 34 })}
    ${arrow(leftX + 310, 504, leftX + 310, 555)}
    ${box(leftX + 70, 568, 480, 96, ['Angular refreshes', 'affected view'], { fill: '#e9f4ff', size: 32 })}
    ${arrow(leftX + 310, 676, leftX + 310, 727)}
    ${box(leftX + 70, 740, 480, 105, ['PULL:', 'template reads name()'], { fill: '#fff0c7', size: 32, lineHeight: 38 })}
    ${panel(rightX, 190, 540, 660, 'KEY IDEA', '#ead6ff')}
    ${textLines(['Signals do not push', 'values into templates.'], rightX + 270, 375, { size: 38, weight: 700 })}
    ${textLines(['They push dirtiness.'], rightX + 270, 550, { size: 42, weight: 800, fill: '#087f38' })}
    ${textLines(['Templates pull the latest', 'value when refreshed.'], rightX + 270, 720, { size: 38, weight: 700 })}
  `;
}

function warningIcon(cx, cy) {
  return `
    <path d="M${cx},${cy - 88} L${cx + 86},${cy + 72} L${cx - 86},${cy + 72} Z" fill="#fff0a8" stroke="#111" stroke-width="6" stroke-linejoin="round"/>
    <path d="M${cx},${cy - 33} V${cy + 22}" stroke="#111" stroke-width="9" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy + 48}" r="7" fill="#111"/>
  `;
}

function timerIcon(cx, cy) {
  return `
    <circle cx="${cx}" cy="${cy}" r="78" fill="#fffdf8" stroke="#111" stroke-width="6"/>
    <circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="#111" stroke-width="4" opacity="0.55"/>
    <rect x="${cx - 24}" y="${cy - 122}" width="48" height="25" rx="8" fill="#fffdf8" stroke="#111" stroke-width="6"/>
    <path d="M${cx - 38},${cy - 94} H${cx + 38}" stroke="#111" stroke-width="7" stroke-linecap="round"/>
    <path d="M${cx - 90},${cy - 72} L${cx - 118},${cy - 100}" stroke="#111" stroke-width="7" stroke-linecap="round"/>
    <path d="M${cx + 90},${cy - 72} L${cx + 118},${cy - 100}" stroke="#111" stroke-width="7" stroke-linecap="round"/>
    <path d="M${cx},${cy} L${cx},${cy - 48} M${cx},${cy} L${cx + 38},${cy - 28}" stroke="#111" stroke-width="7" stroke-linecap="round"/>
    ${[0, 90, 180, 270].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * 49;
      const y1 = cy + Math.sin(rad) * 49;
      const x2 = cx + Math.cos(rad) * 62;
      const y2 = cy + Math.sin(rad) * 62;
      return `<path d="M${x1},${y1} L${x2},${y2}" stroke="#111" stroke-width="5" stroke-linecap="round"/>`;
    }).join('')}
  `;
}

function questionCard(y, fill, icon, lines, opts = {}) {
  const x = 145;
  const w = 1380;
  const h = 255;
  const size = opts.size ?? 46;
  const lineHeight = opts.lineHeight ?? size * 1.27;
  const textY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + size * 0.36;
  return `
    <rect x="${x + 17}" y="${y + 17}" width="${w}" height="${h}" rx="24" fill="#111" opacity="0.96"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${fill}" stroke="#111" stroke-width="5"/>
    ${icon(x + 165, y + h / 2)}
    ${textLines(lines, x + 335, textY, { size, anchor: 'start', weight: 700, lineHeight })}
  `;
}

function twoImportantQuestions() {
  return `
    ${textLines(['TWO IMPORTANT QUESTIONS'], WIDTH / 2, 145, { size: 72, weight: 800 })}
    <path d="M250,205 C345,216 510,198 615,209" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
    ${questionCard(255, '#ffe1e4', warningIcon, ['Why does Angular throw', 'NG0100?'], { size: 50, lineHeight: 62 })}
    ${questionCard(595, '#eef7df', timerIcon, ['Why does setTimeout work,', 'and why is it considered', 'bad practice?'], { size: 43, lineHeight: 55 })}
  `;
}

function sameExample() {
  return `
    ${title('THE SAME EXAMPLE WITH SIGNALS')}
    ${codeBlock(55, 170, 650, 700, [
      '@Component({',
      '  template: `<h1>{{ name() }}</h1>`',
      '})',
      'export class AppComponent',
      '  implements AfterViewInit {',
      "  name = signal('John');",
      '',
      '  ngAfterViewInit() {',
      "    this.name.set('Doe');",
      '  }',
      '}',
    ], { size: 25 })}
    ${panel(785, 170, 820, 700, 'LView TIMELINE', '#e9f4ff')}
    ${box(835, 235, 720, 150, ['1. First check', 'name() -> "John"', 'LView slot = "John"', 'edge recorded'], { fill: '#fff0c7', size: 28, lineHeight: 31 })}
    ${arrow(1195, 398, 1195, 435)}
    ${box(835, 450, 720, 150, ['2. Hook runs', 'name.set("Doe")', 'signal value = "Doe"', 'LView slot still "John"', 'consumer marked dirty'], { fill: '#ffd8da', size: 25, lineHeight: 27 })}
    ${arrow(1195, 612, 1195, 650)}
    ${box(835, 665, 720, 165, ['3. Refresh', 'bindingUpdated("John", "Doe")', 'LView slot = "Doe"', 'DOM updates'], { fill: '#eaf8d7', size: 27, lineHeight: 31 })}
  `;
}

await render('two-important-questions', twoImportantQuestions());
await render('zonejs-vs-signals', zoneVsSignals());
await render('signals-build-a-reactive-graph', reactiveGraph());
await render('templates-become-reactive-consumers', templateConsumer());
await render('push-poll-pull', pushPull());
await render('the-same-example-with-signals', sameExample());

console.log('Rendered updated Signals section slides.');
