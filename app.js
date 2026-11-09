'use strict';
/* Зал · 21 день. Все данные — в localStorage этого устройства, ключ zal2 */
var KEY = 'zal2', S = load(), TODAY = iso(new Date());
var tab = 'home', planDay = 'A', ob = 0, R = null, timer = null, wakeLock = null, figN = 0, editFrom = false;
var sel = TODAY, drag = null, swallowUntil = 0; // выбранный день на главной и свайп по датам
if (history.state && (history.state.r || history.state.s)) history.replaceState(null, ''); // после перезагрузки окон нет
['log', 'body', 'hab'].forEach(function (k) { S[k] = S[k] || {}; });
if (S.prof && !S.train) { S.train = [1, 3, 5]; S.onb = 1; } // данные первой версии
Object.keys(S.log).forEach(function (d) { var L = S.log[d]; if (L.done === undefined && L.ex && d < TODAY) L.done = true; });

var WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
var HABITS = [['p', 'Белок', 'egg'], ['k', 'Калории', 'flame'], ['s', 'Шаги', 'walk'], ['z', 'Сон 7+', 'moon']];
// Какую зону тела качает упражнение — для подписей на фигуре
var EXZ = { legPress: 'quads', inclineDB: 'chest', pulldown: 'back', seatCurl: 'hams', latRaise: 'delts', ohExt: 'arms', calf: 'calves',
  rdl: 'hams', machPress: 'chest', cableRow: 'back', legExt: 'quads', facePull: 'rear', pecDeck: 'chest', hammer: 'arms', crunch: 'abs',
  hack: 'quads', dbBench: 'chest', dbRow: 'back', lyingCurl: 'hams', cableLat: 'delts', pushdown: 'arms', preacher: 'arms' };

/* ---------- Утилиты ---------- */
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Память переполнена — сохрани копию в «Плане»'); }
}
function iso(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function ic(n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
function mmss(s) { return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
function r1(x) { return Math.round(x * 10) / 10; }
function sign(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(r1(x)); }
function ddmm(d) { return +d.slice(8) + '.' + d.slice(5, 7); }
function plural(n, a, b, c) { n = Math.abs(n) % 100; var m = n % 10; return n > 10 && n < 20 ? c : m > 1 && m < 5 ? b : m === 1 ? a : c; }
function dayNo() { return Math.floor((Date.parse(TODAY) - Date.parse(S.start)) / 864e5) + 1; }
function W() { return WEEKS[Math.min(weekOf(S.start, TODAY), 4) - 1]; }
function weekDates(from) { var mon = addDays(from, -((wday(from) + 6) % 7)), o = []; for (var i = 0; i < 7; i++) o.push(addDays(mon, i)); return o; }
function cycleDates() { var o = []; for (var i = 0; i < 21; i++) o.push(addDays(S.start, i)); return o; }
// Плашка снизу. С снимком данных — показывает «Отменить» и держится дольше
var undoSnap = null;
function toast(t, snap) {
  var el = $('toast'); undoSnap = snap || null;
  el.innerHTML = '<span>' + esc(t) + '</span>' + (snap ? '<button data-a="undo">Отменить</button>' : '');
  el.hidden = false; clearTimeout(toast.t);
  toast.t = setTimeout(function () { el.hidden = true; undoSnap = null; }, snap ? 6000 : 2600);
}
// Любое изменение данных через act: снимок до → действие → сохранение → «Отменить»
function act(msg, fn) { var snap = JSON.stringify(S); fn(); save(); toast(msg, snap); }
function undo() {
  if (!undoSnap) return;
  S = JSON.parse(undoSnap); undoSnap = null; save(); $('toast').hidden = true;
  closeSheet(); syncRun(true); render();
  toast('Отменено');
}
var MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function dayName(d) {
  var diff = Math.round((Date.parse(TODAY) - Date.parse(d)) / 864e5);
  return diff === 0 ? 'сегодня' : diff === 1 ? 'вчера' : WD[wday(d)].toLowerCase() + ', ' + +d.slice(8) + ' ' + MON[+d.slice(5, 7) - 1];
}
function totals(L) {
  var sets = 0, ton = 0;
  Object.keys(L.ex || {}).forEach(function (id) { L.ex[id].filter(Boolean).forEach(function (s) { sets++; ton += s[0] * s[1]; }); });
  return { sets: sets, ton: ton };
}
function lastDone() { var d = Object.keys(S.log).filter(function (k) { return S.log[k].done && k < TODAY; }).sort(); return d.length ? S.log[d[d.length - 1]].day : null; }
function nextLetter() { var l = lastDone(); return l ? { A: 'B', B: 'C', C: 'A' }[l] : 'A'; }
// Отказ только в последнем подходе, только с недели 2 и никогда в тяжёлой свободной базе. Добивки — с недели 3
function failMode(it, s, total) {
  var wf = W().fail;
  if (!wf || it.f === 'no' || s !== total - 1) return null;
  return FAIL[it.f].w3 && wf < 2 ? FAIL.last : FAIL[it.f];
}
function failLabel(f) { return f === 'no' ? 'без отказа' : f === 'last' ? 'отказ в последнем' : f === 'lp' ? 'отказ + добивка' : 'отказ + сброс веса'; }
function setsOf(day, i) { return DAYS[day].list[i].s + (i < 2 ? W().plus : 0); }
function minutes(day) { var s = 0; DAYS[day].list.forEach(function (it, i) { s += setsOf(day, i) * (45 + it.rest); }); return Math.round(s / 300) * 5 + 20; }
function lastSets(id, before) {
  var ds = Object.keys(S.log).sort().reverse();
  before = before || TODAY;
  for (var i = 0; i < ds.length; i++) {
    if (ds[i] >= before) continue;
    var x = S.log[ds[i]].ex && S.log[ds[i]].ex[id];
    if (x && x.some(Boolean)) return x.filter(Boolean);
  }
  return null;
}
function weights() { return Object.keys(S.body).sort().filter(function (d) { return S.body[d].w; }).map(function (d) { return [d, S.body[d].w]; }); }
function habCount(d) { var x = S.hab[d] || {}; return HABITS.filter(function (h) { return x[h[0]]; }).length; }
function num(k) { var el = $('f_' + k); return el ? parseFloat(String(el.value).replace(',', '.')) : NaN; }

/* ---------- Медиа ---------- */
function media(id, small) {
  var x = EX[id], v = x.v; if (!v) return '';
  var alt = 'Как выполнять: ' + esc(x.n);
  if (/\.mp4$/.test(v)) return '<video src="media/' + v + '" autoplay muted loop playsinline' + (small ? ' preload="metadata"' : '') + ' aria-label="' + alt + '"></video>';
  var p = v.split('|');
  return '<img src="media/' + p[0] + '" alt="' + alt + '">' + (p[1] ? '<img class="f2" src="media/' + p[1] + '" alt="">' : '');
}
function thumb(id) { var m = media(id, true); return '<span class="th' + (/svg/.test(EX[id].v || '') ? ' svg' : '') + '">' + (m || ic('dumbbell')) + '</span>'; }
function stage(id, tech) {
  var m = media(id), svg = /svg/.test(EX[id].v || '');
  return '<div class="stage' + (m ? (svg ? ' svg' : '') : ' none') + '">' + (m ? m + '<span class="tint"></span>' : figure([EXZ[id]], [], true)) +
    (tech ? '<button class="chip tech" data-a="ex" data-v="' + id + '">' + ic('info') + 'Техника</button>' : '') + '</div>';
}

/* ---------- Туманная фигура ---------- */
// Правая половина силуэта (x ≥ 100), левая — зеркало. Точки сглаживаются кривыми Катмулла–Рома
var FIG = (function () {
  var P = [[100, 62], [109, 66], [112, 80], [132, 86], [150, 95], [159, 114], [163, 146], [164, 176], [167, 206], [166, 232], [169, 250], [164, 264],
    [156, 252], [153, 232], [150, 204], [147, 178], [145, 146], [138, 124], [133, 150], [127, 188], [134, 214], [137, 250], [129, 300], [131, 330],
    [122, 368], [128, 383], [104, 386], [107, 368], [110, 330], [106, 300], [104, 254], [100, 236]];
  var d = 'M' + P[0];
  for (var i = 0; i < P.length - 1; i++) {
    var a = P[i - 1] || P[i], b = P[i], c = P[i + 1], e = P[i + 2] || c;
    d += 'C' + [(b[0] + (c[0] - a[0]) / 6).toFixed(1), (b[1] + (c[1] - a[1]) / 6).toFixed(1)] + ' ' + [(c[0] - (e[0] - b[0]) / 6).toFixed(1), (c[1] - (e[1] - b[1]) / 6).toFixed(1)] + ' ' + c;
  }
  d += 'Z';
  return '<ellipse cx="100" cy="38" rx="19" ry="25"/><path d="' + d + '"/><path d="' + d + '" transform="matrix(-1 0 0 1 200 0)"/>';
})();
var ZONES = {
  chest: [[88, 112, 15, 11], [112, 112, 15, 11]], delts: [[50, 102, 11, 13], [150, 102, 11, 13]], rear: [[50, 102, 11, 13], [150, 102, 11, 13]],
  arms: [[48, 150, 9, 22], [152, 150, 9, 22]], abs: [[100, 164, 14, 30]], back: [[69, 142, 8, 24], [131, 142, 8, 24]],
  glutes: [[100, 222, 30, 11]], quads: [[81, 264, 13, 32], [119, 264, 13, 32]], hams: [[81, 276, 10, 26], [119, 276, 10, 26]],
  calves: [[82, 336, 8, 20], [118, 336, 8, 20]]
};
var LBL = { chest: [118, 110, 'r', 'Грудь'], back: [68, 142, 'l', 'Спина'], quads: [80, 262, 'l', 'Ноги'], hams: [120, 280, 'r', 'Бицепс бедра'],
  glutes: [124, 222, 'r', 'Ягодицы'], delts: [50, 102, 'l', 'Плечи'], rear: [50, 102, 'l', 'Плечи'], arms: [152, 152, 'r', 'Руки'],
  abs: [104, 172, 'r', 'Пресс'], calves: [82, 340, 'l', 'Икры'] };
function figure(z, labels, small, subs) {
  var id = 'fg' + (++figN);
  // Свечение мышц — радиальный градиент, без фильтров и масок: Safari на iPhone рисовал размытие в маске с прямоугольными краями.
  // Ниже по телу свечение тише — как и сама фигура, которая растворяется к ногам
  function zs(f, g) { return (z || []).map(function (k) { return (ZONES[k] || []).map(function (e) {
    return '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="' + e[2] * f + '" ry="' + e[3] * f + '" fill="url(#' + id + g + ')" opacity="' + Math.max(0.35, Math.min(1, 1.2 - e[1] / 420)).toFixed(2) + '"/>';
  }).join(''); }).join(''); }
  var lab = (labels || []).map(function (k) {
    var L = LBL[k]; if (!L) return '';
    var sub = subs && subs[k] || '', w = Math.max(L[3].length * 6.6, sub.length * 5.4) + 24, h = sub ? 36 : 24, r = L[2] === 'r';
    var px = r ? 192 : 8 - w, y = L[1] - h / 2;
    return '<line x1="' + L[0] + '" y1="' + L[1] + '" x2="' + (r ? px : px + w) + '" y2="' + L[1] + '" stroke="rgba(255,240,228,.32)" stroke-width=".8"/>' +
      '<circle cx="' + L[0] + '" cy="' + L[1] + '" r="2.6" fill="#F6F0EA"/>' +
      '<rect x="' + px + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (sub ? 12 : 12) + '" fill="rgba(18,11,8,.55)" stroke="rgba(255,240,228,.18)"/>' +
      '<text x="' + (px + 12) + '" y="' + (y + (sub ? 15 : 16)) + '" fill="#F6F0EA" font-size="12">' + L[3] + '</text>' +
      (sub ? '<text x="' + (px + 12) + '" y="' + (y + 28) + '" fill="#A39A92" font-size="10">' + esc(sub) + '</text>' : '');
  }).join('');
  return '<div class="fig' + (small ? ' sm' : '') + '" aria-hidden="true"><svg viewBox="-100 0 400 400" preserveAspectRatio="xMidYMid meet">' +
    '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".96"/><stop offset=".42" stop-color="#fff" stop-opacity=".72"/><stop offset=".74" stop-color="#fff" stop-opacity=".26"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<filter id="' + id + 'a" filterUnits="userSpaceOnUse" x="-100" y="-90" width="400" height="580"><feGaussianBlur stdDeviation="22"/></filter>' +
    '<filter id="' + id + 'b" filterUnits="userSpaceOnUse" x="-100" y="-90" width="400" height="580"><feGaussianBlur stdDeviation="4"/></filter>' +
    '<filter id="' + id + 'h" filterUnits="userSpaceOnUse" x="-100" y="-90" width="400" height="580"><feGaussianBlur stdDeviation="9"/></filter>' +
    '<filter id="' + id + 'm" filterUnits="userSpaceOnUse" x="-100" y="-90" width="400" height="580"><feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="b"/>' +
    '<feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="1" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.6 -.35" result="g"/>' +
    '<feComposite in="b" in2="g" operator="arithmetic" k1=".28" k2=".78" k3="0" k4="0"/></filter>' +
    '<radialGradient id="' + id + 'z"><stop offset="0" stop-color="#FF5A1A" stop-opacity=".95"/><stop offset=".45" stop-color="#FF6B2C" stop-opacity=".6"/><stop offset="1" stop-color="#FF6B2C" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="' + id + 'y"><stop offset="0" stop-color="#FFB27E" stop-opacity=".85"/><stop offset="1" stop-color="#FF8A4C" stop-opacity="0"/></radialGradient></defs>' +
    '<g fill="#FFD7BC" opacity=".38" filter="url(#' + id + 'a)">' + FIG + '</g>' +
    '<g fill="url(#' + id + 'g)" filter="url(#' + id + 'm)">' + FIG + '</g>' +
    '<g fill="#fff" opacity=".28" filter="url(#' + id + 'h)" transform="translate(100 170) scale(.8 .86) translate(-100 -170)">' + FIG + '</g>' +
    zs(1.7, 'z') + zs(.75, 'y') +
    lab + '</svg></div>';
}
// Подписи на фигуре: сколько подходов на зону сегодня
function zoneSubs(day) {
  var o = {};
  DAYS[day].list.forEach(function (it, i) { var z = EXZ[it.e]; if (z) o[z] = (o[z] || 0) + setsOf(day, i); });
  Object.keys(o).forEach(function (k) { o[k] = o[k] + ' ' + plural(o[k], 'подход', 'подхода', 'подходов'); });
  return o;
}

/* ---------- Толстая дуга (оценка, отдых) ---------- */
function arc(p, id, knob, uid) {
  p = Math.max(0, Math.min(1, p));
  var r = 128, len = Math.PI * r, d = 'M22 150A128 128 0 0 1 278 150', a = Math.PI * (1 - p);
  var kx = (150 + r * Math.cos(a)).toFixed(1), ky = (150 - r * Math.sin(a)).toFixed(1);
  return '<svg viewBox="0 0 300 172" role="img" aria-label="' + Math.round(p * 100) + ' из 100"><defs><linearGradient id="' + id + '" x1="0" x2="1">' +
    '<stop offset="0" stop-color="#4A2414"/><stop offset=".45" stop-color="#C8501E"/><stop offset=".8" stop-color="#FF8A4C"/><stop offset="1" stop-color="#FFD0AE"/></linearGradient></defs>' +
    '<path d="' + d + '" fill="none" stroke="#211A16" stroke-width="34" stroke-linecap="round"/>' +
    '<path ' + (uid ? 'id="' + uid + 'p" ' : '') + 'd="' + d + '" fill="none" stroke="url(#' + id + ')" stroke-width="34" stroke-linecap="round" stroke-dasharray="' + (len * p).toFixed(1) + ' ' + (len + 40).toFixed(1) + '"' + (p ? '' : ' opacity="0"') + '/>' +
    (knob ? '<g ' + (uid ? 'id="' + uid + 'k" ' : '') + 'transform="translate(' + kx + ' ' + ky + ')"><circle r="19" fill="#F6F0EA"/><circle r="6" fill="#1A120D"/></g>' : '') + '</svg>';
}
function setArc(uid, p) {
  var pa = $(uid + 'p'), k = $(uid + 'k'), r = 128, len = Math.PI * r, a = Math.PI * (1 - p);
  if (pa) { pa.setAttribute('stroke-dasharray', (len * p).toFixed(1) + ' ' + (len + 40).toFixed(1)); pa.setAttribute('opacity', p ? 1 : 0); }
  if (k) k.setAttribute('transform', 'translate(' + (150 + r * Math.cos(a)).toFixed(1) + ' ' + (150 - r * Math.sin(a)).toFixed(1) + ')');
}

/* ---------- Рендер ---------- */
function render() {
  figN = 0;
  $('nav').hidden = !S.onb;
  if (!S.onb) { $('main').innerHTML = onboarding(); return; }
  document.querySelectorAll('#nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tab); });
  $('main').innerHTML = { home: home, prog: progress, food: food, plan: plan }[tab]();
}

/* ---------- Онбординг ---------- */
function onboarding() {
  var P = S.prof || { h: 180, age: 30, w: 104 };
  var steps = '<div class="obtop"><button class="ib" data-a="ob" data-v="' + (ob - 1) + '" aria-label="Назад">' + ic('back') + '</button><div class="steps">' +
    [1, 2, 3].map(function (i) { return '<i class="' + (i <= ob ? 'd' : '') + '"></i>'; }).join('') + '</div><span class="t3 xs">' + ob + ' из 3</span></div>';
  if (ob === 0) return '<div class="onb"><section class="sky grain"><div class="top"><div class="logo">' + ic('sun') + 'Зал</div><span class="chip">21 день</span></div>' +
    figure(['chest', 'delts', 'arms', 'abs', 'quads', 'back'], []) +
    '<div class="cap"><span class="eyebrow">План на 3 недели</span><h1>Минус жир,<br>плюс мышцы</h1><p>Три тренировки в неделю. Каждое упражнение — на видео, вес и повторы подскажу сам</p></div></section>' +
    '<div class="grow"></div><button class="pb wide" data-a="ob" data-v="1">Начать</button></div>';
  if (ob === 1) return '<div class="onb">' + steps + '<h1>Расскажи о себе</h1><p class="lead">Посчитаю калории и белок под тебя</p><div class="fields">' +
    stepper('h', P.h, 'рост, см', 1) + stepper('age', P.age, 'возраст', 1) + stepper('w', P.w, 'вес, кг', 0.5) +
    '</div><div class="grow"></div><button class="pb wide" data-a="ob" data-v="2">Дальше</button></div>';
  if (ob === 2) return '<div class="onb">' + steps + '<h1>Когда удобно ходить в зал?</h1><p class="lead">Между тренировками нужен день отдыха — в нём растут мышцы</p><div style="margin-top:18px">' +
    trainOpts(S.train || [1, 3, 5]) + '</div><div class="grow"></div><button class="pb wide" data-a="ob" data-v="3">Дальше</button></div>';
  return '<div class="onb">' + steps + '<h1>Сфотографируйся «до»</h1><p class="lead">Через 21 день сделаешь такие же фото. Зеркало привыкает, фото — нет</p>' +
    '<div class="card"><ul class="tips"><li>Утром, натощак</li><li>То же место и тот же свет</li><li>Спереди, сбоку и спиной</li><li>Живот не втягивать</li></ul></div>' +
    '<div class="grow"></div><button class="pb wide" data-a="obdone" data-v="1">Готово, начинаем</button><button class="lnk" data-a="obdone">Сделаю позже</button></div>';
}
function trainOpts(T) {
  return [[[1, 3, 5], 'Пн, Ср, Пт', 'удобнее всего'], [[2, 4, 6], 'Вт, Чт, Сб', ''], [[0, 2, 4], 'Вс, Вт, Чт', '']].map(function (c) {
    return '<button class="opt' + (String(c[0]) === String(T) ? ' on' : '') + '" data-a="train" data-v="' + c[0] + '"><span>' + c[1] + (c[2] ? '<small>' + c[2] + '</small>' : '') + '</span><i class="rb"></i></button>';
  }).join('');
}
function stepper(k, v, label, step) {
  return '<div class="stp"><button data-a="inc" data-k="' + k + '" data-d="-' + step + '" aria-label="Меньше">' + ic('minus') + '</button>' +
    '<label><input id="f_' + k + '" inputmode="decimal" value="' + (v === undefined || v === null ? '' : v) + '" aria-label="' + label + '"><small>' + label + '</small></label>' +
    '<button data-a="inc" data-k="' + k + '" data-d="' + step + '" aria-label="Больше">' + ic('plus') + '</button></div>';
}

/* ---------- Сегодня ---------- */
// Что в этот день: сделано / пропуск / отдых / план. Будущее — по кругу A→B→C от сегодняшнего дня
function dayInfo(d) {
  var L = S.log[d] || {}, started = !!(L.ex && Object.keys(L.ex).length), range = [];
  if (d >= TODAY) { for (var x = TODAY; x <= d; x = addDays(x, 1)) range.push(x); } else range = [d];
  var st = schedule(range, TODAY, S.log, S.train)[d];
  return { L: L, started: started, st: st.st, day: L.day || st.day };
}
function home() {
  var wd = weekDates(TODAY), n = dayNo(), w = W(), isToday = sel === TODAY, info = dayInfo(sel), L = info.L, started = info.started;
  var mode = isToday ? (L.done ? 'done' : (info.st === 'today' || started) ? 'train' : 'rest')
    : sel < TODAY ? (L.done || started ? 'past' : info.st === 'miss' ? 'miss' : 'rest') : (info.st === 'plan' ? 'future' : 'rest');
  var day = info.day || nextLetter(), D = DAYS[day];

  // даты на дуге вокруг выбранного дня; листаются свайпом и нажатием
  var around = []; for (var o = -3; o <= 3; o++) around.push(addDays(sel, o));
  var fut = [], pastSc = {}; around.forEach(function (d) { if (d < TODAY) pastSc[d] = schedule([d], TODAY, S.log, S.train)[d]; else fut.push(d); });
  var futSc = fut.length ? schedule(fut[0] === TODAY ? fut : [TODAY].concat(fut), TODAY, S.log, S.train) : {};
  var h = '<section class="sky grain' + (/rest|miss/.test(mode) ? ' calm' : '') + '"><div class="top"><div class="logo">' + ic('sun') + 'Зал</div>' +
    (isToday ? '<span class="chip">' + ic('target') + (n > 21 ? '21 день пройден' : 'День ' + Math.max(1, n) + ' из 21') + '</span>'
      : '<button class="chip" data-a="sel" data-v="' + TODAY + '">' + ic('back') + 'К сегодня</button>') + '</div>' +
    '<div class="dates" aria-label="Дни: листай или нажми">' +
    around.map(function (d, i) {
      var off = i - 3, a = Math.abs(off), st = (pastSc[d] || futSc[d] || { st: 'rest' }).st;
      return '<button class="dt ' + st + (off ? '' : ' on') + (d === TODAY ? ' now' : '') + '" data-a="sel" data-v="' + d + '" aria-label="' + dayName(d) + '" style="left:calc(50% + ' + off * 54 + 'px);top:' + (a * a * 5) + 'px;opacity:' + (1 - a * 0.2) + '"><b>' + +d.slice(8) + '</b>' + WD[wday(d)] + '<i></i></button>';
    }).join('') + '</div>';

  var when = isToday ? '' : dayName(sel);
  if (mode === 'rest') {
    h += figure([], []) + '<div class="cap"><span class="eyebrow">' + (when || 'Восстановление') + '</span><h1>День отдыха</h1>' +
      '<p>Мышцы растут, пока ты отдыхаешь. ' + (isToday ? 'Сегодня — ' : '') + 'прогулка 40–60 минут</p>' +
      '<div class="meta"><span>' + ic('walk') + '8–10 тыс. шагов</span><span>' + ic('moon') + 'сон 7+ часов</span></div>' +
      (isToday ? '<button class="pb gh" data-a="go" data-v="' + day + '">Всё равно тренироваться</button>' : '') + '</div>';
  } else if (mode === 'miss') {
    h += figure([], []) + '<div class="cap"><span class="eyebrow">' + when + '</span><h1>Пропущено</h1>' +
      '<p>Ничего страшного: следующая тренировка продолжит круг с того же места</p></div>';
  } else if (mode === 'past') {
    var tt = totals(L);
    h += figure(DAYS[L.day].z, DAYS[L.day].z.slice(0, 3)) + '<div class="cap"><span class="eyebrow">' + (L.done ? 'Сделано' : 'Не закончена') + ' · ' + when + '</span>' +
      '<h1>' + esc(DAYS[L.day].t) + '</h1><p>' + tt.sets + ' ' + plural(tt.sets, 'подход', 'подхода', 'подходов') + ' · ' + Math.round(tt.ton).toLocaleString('ru') + ' кг' + (L.cardio ? ' · ходьба' : '') + '</p>' +
      '<button class="pb gh" data-a="hist" data-v="' + sel + '">Открыть и исправить</button></div>';
  } else if (mode === 'future') {
    var nm = D.list.slice(0, 3).map(function (it) { return EX[it.e].n.toLowerCase(); }).join(', ');
    h += figure(D.z, D.z.slice(0, 3), false, zoneSubs(day)) + '<div class="cap"><span class="eyebrow">Запланировано · ' + when + '</span>' +
      '<h1>' + esc(D.t) + '</h1><p>' + esc(nm.charAt(0).toUpperCase() + nm.slice(1)) + ' и ещё ' + (D.list.length - 3) + '</p>' +
      '<div class="meta"><span>' + ic('clock') + '~' + minutes(day) + ' мин</span><span>Тренировка ' + day + '</span></div>' +
      '<button class="pb gh" data-a="pplan" data-v="' + day + '">Посмотреть упражнения</button></div>';
  } else {
    var names = D.list.slice(0, 3).map(function (it) { return EX[it.e].n.toLowerCase(); }).join(', ');
    h += figure(D.z, D.z.slice(0, 3), false, zoneSubs(day)) + '<div class="cap"><span class="eyebrow">' + (mode === 'done' ? 'Сделано сегодня' : 'Тренировка ' + day) + '</span>' +
      '<h1>' + esc(D.t) + '</h1><p>' + esc(names.charAt(0).toUpperCase() + names.slice(1)) + ' и ещё ' + (D.list.length - 3) + '</p>' +
      '<div class="meta"><span>' + ic('clock') + '~' + minutes(day) + ' мин</span><span>' + ic('list') + D.list.length + ' ' + plural(D.list.length, 'упражнение', 'упражнения', 'упражнений') + '</span></div>' +
      (mode === 'done' ? '<button class="pb gh" data-a="summary">Итог тренировки</button>'
        : '<button class="pb play" data-a="go" data-v="' + day + '">' + ic('play') + (started ? 'Продолжить' : 'Начать') + '</button>') +
      (mode === 'train' && !started ? '<button class="lnk" data-a="pick">Выбрать другую тренировку</button>' : '') + '</div>';
  }
  h += '</section>';

  if (n === 1 && !S.photo1 || n >= 22 && !S.photo2) {
    h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('camera') + '</span>' + (n === 1 ? 'Фото «до»' : 'Фото «после»') + '</span>' +
      '<button class="sel" data-a="photo">Сделал</button></div><p class="t2 sm" style="margin-top:10px">Утром натощак, тот же свет. Спереди, сбоку, спиной</p></div>';
  }

  // форма недели: тонкая цифра + столбики по дням
  var s = score(wd, TODAY, S.log, S.hab, S.train);
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('chart') + '</span>Форма недели</span><span class="sel">' + esc(w.t.split(' · ')[0]) + '</span></div>' +
    '<div class="fc"><div><div class="num-xl">' + (s === null ? '—' : s + '<small>%</small>') + '</div><div class="t2 xs" style="margin-top:8px">тренировки и привычки</div></div><div class="bars">' +
    wd.map(function (d) {
      var lbl = WD[wday(d)].charAt(0);
      if (d > TODAY) return '<span><i class="f" style="height:46px"></i>' + lbl + '</span>';
      var trainDay = S.train.indexOf(wday(d)) >= 0, done = S.log[d] && S.log[d].done, hc = habCount(d);
      var v = trainDay || done ? (done ? 0.5 : 0) + 0.125 * hc : 0.25 * hc;
      return '<span' + (d === TODAY ? ' class="now"' : '') + '><i class="' + (d === TODAY ? 't' : 'd') + '" style="height:' + Math.round(6 + v * 52) + 'px"></i>' + lbl + '</span>';
    }).join('') + '</div></div>';
  var ws = weights(), a = avg7(ws.map(function (x) { return x[1]; })), doneN = Object.keys(S.log).filter(function (d) { return S.log[d].done; }).length;
  h += '<div class="trio"><button class="trio-b" data-a="weigh"><b>' + (a || '—') + '</b><span>' + (a ? 'вес, кг' : 'записать вес') + '</span></button>' +
    '<div><b class="ac">' + (ws.length > 1 ? sign(a - ws[0][1]) : '—') + '</b><span>кг с начала</span></div>' +
    '<div><b>' + doneN + '<span class="t3"> / 9</span></b><span>тренировок</span></div></div>' +
    '<p class="t2 sm" style="margin-top:14px">' + esc(w.d) + '</p></div>';

  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('check') + '</span>Сегодня</span><span class="t3 xs">нажми, что сделал</span></div>' + habits() + '</div>';
  return h;
}
function habits() {
  var H = S.hab[TODAY] || {};
  return '<div class="habs">' + HABITS.map(function (x) {
    return '<button class="hab' + (H[x[0]] ? ' on' : '') + '" data-a="hab" data-v="' + x[0] + '" aria-pressed="' + !!H[x[0]] + '"><span class="o">' + ic(H[x[0]] ? 'check' : x[2]) + '</span>' + x[1] + '</button>';
  }).join('') + '</div>';
}

/* ---------- Прогресс ---------- */
function progress() {
  var wd = weekDates(TODAY), sc = score(wd, TODAY, S.log, S.hab, S.train);
  var pw = weekDates(addDays(wd[0], -7)), prev = pw[6] >= S.start ? score(pw, pw[6], S.log, S.hab, S.train) : null;
  var h = '<div class="pg-h"><h1>Прогресс</h1><span class="sel">Неделя ' + Math.min(weekOf(S.start, TODAY), 3) + ' из 3</span></div>';
  h += '<div class="card center"><div class="gw">' + arc(sc === null ? 0 : sc / 100, 'ga', sc !== null) +
    '<div class="v"><span class="num-xl">' + (sc === null ? '—' : sc + '<small>/100</small>') + '</span></div></div>' +
    '<span class="pill-d">' + (sc === null ? 'неделя только началась' : prev !== null ? (sc >= prev ? ic('trend') : '') + sign(sc - prev) + ' к прошлой неделе' : 'первая неделя') + '</span>' +
    '<h3 style="margin-top:14px">Оценка недели</h3><p class="t2 sm" style="margin:4px auto 0;max-width:300px">' +
    (sc === null ? 'Появится после первой тренировки или отметки на главной' : 'Тренировки по плану и привычки: белок, калории, шаги, сон') + '</p></div>';

  var cd = cycleDates(), cs = schedule(cd, TODAY, S.log, S.train);
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('sun') + '</span>Активность</span><span class="sel">21 день · ' + ddmm(cd[0]) + '–' + ddmm(cd[20]) + '</span></div><div class="caps">' +
    cd.slice(0, 7).map(function (d) { return '<span class="wd">' + WD[wday(d)] + '</span>'; }).join('') +
    cd.map(function (d) {
      var st = cs[d].st, c = st === 'done' ? 'done' : d > TODAY ? 'fut' : habCount(d) >= 2 ? 'part' : d === TODAY ? 'fut' : 'none';
      return '<i class="cp ' + c + (d === TODAY ? ' today' : '') + '" title="' + ddmm(d) + '"></i>';
    }).join('') + '</div><div class="lg"><span><i class="cp done"></i>Тренировка</span><span><i class="cp part"></i>Только привычки</span><span><i class="cp none"></i>Ничего</span></div></div>';

  var ws = weights(), vals = ws.map(function (x) { return x[1]; }), a = avg7(vals);
  var start = vals.length ? vals[0] : S.prof.w, goal = r1(start - 3), cur = a || start;
  var pos = Math.max(0.04, Math.min(0.96, (start - cur) / (start - goal)));
  var lastD = ws.length ? ws[ws.length - 1][0] : null, ago = lastD ? Math.round((Date.parse(TODAY) - Date.parse(lastD)) / 864e5) : null;
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('scale') + '</span>Средний вес за 7 дней</span><span class="t3 xs">' +
    (ago === null ? 'нет замеров' : ago === 0 ? 'замер сегодня' : ago === 1 ? 'замер вчера' : ago + ' дн. назад') + '</span></div>' +
    '<div class="num-l" style="margin-top:14px">' + (a || '—') + '<small> кг</small></div>' +
    '<div class="range"><span class="mk" style="left:' + (pos * 100).toFixed(1) + '%"><i></i>' + r1(cur) + '</span></div>' +
    '<div class="rl"><span>Старт <b>' + start + '</b></span><span>Цель за 21 день <b>' + goal + '</b></span></div>' +
    (ws.length > 1 ? chart(ws) : '') +
    '<div class="pair" style="grid-template-columns:1.4fr 1fr;margin-top:16px"><button class="pb gh" style="height:48px" data-a="weigh">' + ic('plus') + 'Записать</button>' +
    '<button class="pb gh" style="height:48px" data-a="wlist"' + (Object.keys(S.body).length ? '' : ' disabled') + '>Все замеры</button></div></div>';

  var hist = Object.keys(S.log).filter(function (d) { return S.log[d].done || S.log[d].ex && Object.keys(S.log[d].ex).length; }).sort().reverse();
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('list') + '</span>История тренировок</span><span class="t3 xs">нажми, чтобы изменить</span></div><div style="margin-top:6px">' +
    (hist.length ? hist.map(function (d) {
      var L = S.log[d], st = totals(L);
      return '<button class="exl" data-a="hist" data-v="' + d + '"><span class="th dn">' + L.day + '</span><div><b>' + esc(DAYS[L.day].t) + '</b><small>' + dayName(d) + ' · ' + st.sets + ' ' + plural(st.sets, 'подход', 'подхода', 'подходов') +
        (L.done ? '' : ' · не закончена') + '</small></div>' + ic('next') + '</button>';
    }).join('') : '<p class="t2 sm" style="padding:8px 0">Пока пусто — здесь появятся все тренировки</p>') + '</div></div>';

  var str = strength();
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('dumbbell') + '</span>Сила</span><span class="t3 xs">первый раз → сейчас</span></div><div class="lst" style="margin-top:8px">' +
    (str.length ? str.join('') : '<p class="t2 sm" style="padding:8px 0">Появится после первой тренировки</p>') + '</div></div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('target') + '</span>Чего ждать за 21 день</span></div><table class="tbl" style="margin-top:6px">' +
    EXPECT.map(function (e) { return '<tr><td>' + esc(e[0]) + '<div class="t3 xs">' + esc(e[2]) + '</div></td><td>' + esc(e[1]) + '</td></tr>'; }).join('') + '</table></div>';
  return h;
}
function chart(ws) {
  var v = ws.map(function (x) { return x[1]; }), mn = Math.min.apply(null, v) - 0.4, mx = Math.max.apply(null, v) + 0.4, Wd = 320, H = 120;
  var pts = v.map(function (x, i) { return [(i / (v.length - 1)) * (Wd - 34), 6 + (1 - (x - mn) / (mx - mn)) * (H - 26)]; });
  var line = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  var grid = [0, 0.5, 1].map(function (f) { var y = 6 + f * (H - 26); return '<line class="g" x1="0" x2="' + (Wd - 34) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (Wd - 28) + '" y="' + (y + 3) + '">' + r1(mx - f * (mx - mn)) + '</text>'; }).join('');
  return '<svg class="chart" viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="Вес от ' + v[0] + ' до ' + v[v.length - 1] + ' кг">' +
    '<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF6B2C" stop-opacity=".3"/><stop offset="1" stop-color="#FF6B2C" stop-opacity="0"/></linearGradient></defs>' + grid +
    '<polygon class="ar" points="0,' + (H - 20) + ' ' + line + ' ' + pts[pts.length - 1][0].toFixed(1) + ',' + (H - 20) + '"/><polyline class="ln" points="' + line + '"/>' +
    '<text x="0" y="' + (H - 4) + '">' + ddmm(ws[0][0]) + '</text><text x="' + (Wd - 34) + '" y="' + (H - 4) + '" text-anchor="end">' + ddmm(ws[ws.length - 1][0]) + '</text></svg>';
}
function strength() {
  var first = {}, last = {};
  Object.keys(S.log).sort().forEach(function (d) {
    var ex = S.log[d].ex || {};
    Object.keys(ex).forEach(function (id) {
      var m = Math.max.apply(null, ex[id].filter(Boolean).map(function (s) { return s[0]; }));
      if (!isFinite(m) || !EX[id] || !EX[id].inc) return;
      if (first[id] === undefined) first[id] = m; last[id] = m;
    });
  });
  var ids = Object.keys(last), top = Math.max.apply(null, ids.map(function (i) { return last[i]; }).concat([1]));
  return ids.sort(function (a, b) { return (last[b] - first[b]) / (first[b] || 1) - (last[a] - first[a]) / (first[a] || 1); }).slice(0, 8).map(function (id) {
    var d = last[id] - first[id];
    return '<div class="r"><span>' + esc(EX[id].n) + '</span><span><span class="t3">' + first[id] + ' → </span>' + last[id] + ' кг' + (d > 0 ? ' <span class="up">' + sign(d) + '</span>' : '') + '</span>' +
      '<span class="tr"><i style="width:' + Math.round(last[id] / top * 100) + '%"></i></span></div>';
  });
}

/* ---------- Еда ---------- */
function food() {
  var m = macros(S.prof), per = Math.round(m.prot / 4);
  var h = '<div class="pg-h"><h1>Питание</h1><button class="sel" data-a="prof">' + ic('gear') + 'мои данные</button></div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('flame') + '</span>Норма на день</span><span class="t3 xs">тратишь ~' + m.tdee + '</span></div>' +
    '<div class="num-xl" style="margin-top:16px">' + m.kcal.toLocaleString('ru') + '<small> ккал</small></div>' +
    '<p class="t2 sm" style="margin-top:8px">На 500 меньше, чем тратишь: жир уходит, мышцы остаются</p>' +
    '<div class="mac"><i style="flex:' + m.prot * 4 + ';background:var(--ac)"></i><i style="flex:' + m.fat * 9 + ';background:var(--ac3)"></i><i style="flex:' + m.carb * 4 + ';background:#7A3A1C"></i></div>' +
    '<div class="macl"><div><span><i style="background:var(--ac)"></i>Белок</span><b>' + m.prot + ' г</b></div><div><span><i style="background:var(--ac3)"></i>Жиры</span><b>' + m.fat + ' г</b></div><div><span><i style="background:#7A3A1C"></i>Углеводы</span><b>' + m.carb + ' г</b></div></div></div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('egg') + '</span>Белок: 4 приёма по ~' + per + ' г</span></div><div style="margin-top:8px">' +
    [['Куриная грудка, 200 г сырой', '46 г'], ['Творог 5%, 250 г', '42 г'], ['Треска или минтай, 250 г', '42 г'], ['Говядина постная, 200 г сырой', '40 г'],
     ['Греческий йогурт, 300 г', '30 г'], ['Протеин, 1 мерная ложка', '24 г'], ['Яйца, 3 шт', '19 г']].map(function (f) { return '<div class="fd"><span>' + f[0] + '</span><span>' + f[1] + '</span></div>'; }).join('') + '</div></div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('check') + '</span>Сегодня</span><span class="t3 xs">нажми, что сделал</span></div>' + habits() + '</div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('info') + '</span>Чтобы держалось</span></div><ul class="tips">' + [
    'В каждом приёме — белок и две горсти овощей', 'Рис, гречка, картофель, овсянка — ближе к тренировке', 'Не пей калории: соки, газировка, алкоголь',
    'Вода — 30–35 мл на кг веса', 'Креатин 3–5 г в день: +сила, на весах +1–2 кг воды — это не жир',
    'Средний вес за 2 недели не упал на 0,5–1 кг — убери 150–200 ккал углеводов'
  ].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
  return h;
}

/* ---------- План ---------- */
function plan() {
  var D = DAYS[planDay], wn = Math.min(weekOf(S.start, TODAY), 4);
  var h = '<div class="pg-h"><h1>Программа</h1><span class="sel">3 × в неделю</span></div><p class="t2 sm">Ноги — отдельный день, верх — два разных дня. Идут по кругу: A, B, C</p>';
  h += '<div class="seg" role="tablist">' + ['A', 'B', 'C'].map(function (k) { return '<button role="tab" aria-selected="' + (k === planDay) + '" class="' + (k === planDay ? 'on' : '') + '" data-a="pday" data-v="' + k + '">День ' + k + '</button>'; }).join('') + '</div>';
  h += '<div class="card"><div class="ch"><h3>' + esc(D.t) + '</h3><span class="t3 xs">~' + minutes(planDay) + ' мин</span></div><div style="margin-top:8px">' +
    D.list.map(function (it, i) {
      return '<button class="exl" data-a="ex" data-v="' + it.e + '">' + thumb(it.e) + '<div><b>' + esc(EX[it.e].n) + '</b><small>' + setsOf(planDay, i) + ' × ' + it.r[0] + '–' + it.r[1] + ' · отдых ' + mmss(it.rest) + ' · ' + failLabel(it.f) + '</small></div>' + ic('next') + '</button>';
    }).join('') + '</div><p class="t2 xs" style="margin-top:10px">В конце — 15 минут ходьбы в горку: наклон 10%, 5 км/ч</p></div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('repeat') + '</span>3 недели</span><span class="t3 xs">«в запасе» — сколько ещё мог бы</span></div><div style="margin-top:6px">' +
    WEEKS.slice(0, 3).map(function (x, i) {
      return '<div class="wk' + (i + 1 === wn ? ' now' : '') + '"><span class="n">' + (i + 1) + '</span><div><b style="font-weight:400">' + esc(x.t.split(' · ')[1]) + '</b><p>' + esc(x.d) + '</p></div><span class="t2 xs">' + x.rir + ' в запасе</span></div>';
    }).join('') + '</div></div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('flame') + '</span>Отказ: где и как</span><span class="t3 xs">с недели 2</span></div><div style="margin-top:6px">' +
    ['no', 'last', 'lp', 'drop'].map(function (k) {
      var ex = [], F = FAIL[k];
      ['A', 'B', 'C'].forEach(function (dd) { DAYS[dd].list.forEach(function (it) { if (it.f === k) ex.push(EX[it.e].n.split(' (')[0].toLowerCase()); }); });
      return '<div class="rule"><b style="font-weight:400">' + esc(F.t) + (F.w3 ? ' <span class="t3 xs">· неделя 3</span>' : '') + '</b><p>' + esc(F.d) + '</p><div class="src">' + esc(ex.join(', ')) + '</div></div>';
    }).join('') + '</div><p class="t3 xs" style="margin-top:8px">Отказ — когда не можешь сделать ещё один повтор с правильной техникой. Приложение само подскажет, на каком подходе</p></div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('book') + '</span>Почему так</span><span class="t3 xs">исследования</span></div><div style="margin-top:6px">' +
    RULES.map(function (r) { return '<div class="rule"><b style="font-weight:400">' + esc(r[0]) + '</b><p>' + esc(r[1]) + '</p><div class="src">' + esc(r[2]) + '</div></div>'; }).join('') + '</div></div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('clock') + '</span>Напоминания</span><span class="t3 xs">iPhone и Android</span></div>' +
    '<p class="t2 sm" style="margin-top:12px">Тренировки попадут в Календарь телефона — он сам напомнит за 30 минут, даже если приложение закрыто</p>' +
    '<label class="t2 xs" style="display:block;margin-top:12px">Во сколько обычно тренируешься<input type="time" id="rtime" class="date-in" value="' + (S.rtime || '18:00') + '"></label>' +
    '<button class="pb wide" style="margin-top:12px" data-a="ics">' + ic('plus') + 'Добавить в Календарь</button>' +
    '<button class="opt' + (S.nt ? ' on' : '') + '" style="margin-top:14px" data-a="nt"><span>На экран блокировки<small>конец отдыха, «сегодня тренировка»</small></span><i class="rb"></i></button>' +
    (S.nt ? '<button class="lnk" data-a="nthelp">Настроить и проверить</button>' : '') + '</div>';
  h += '<div class="card"><div class="ch"><span class="l"><span class="ico">' + ic('gear') + '</span>Настройки</span></div><p class="t2 xs" style="margin-top:14px">Дни тренировок</p>' + trainOpts(S.train) +
    '<label class="t2 xs" style="display:block;margin-top:16px">Начало программы<input type="date" id="sd" class="date-in" value="' + S.start + '"></label>' +
    '<div class="pair" style="grid-template-columns:1fr 1fr;margin-top:16px"><button class="pb gh" data-a="exp">Сохранить копию</button><button class="pb gh" data-a="imp">Загрузить</button></div>' +
    '<input type="file" id="impf" accept=".json,application/json" hidden><button class="lnk" data-a="wipe">Начать заново</button></div>';
  h += '<p class="t3 xs" style="margin:16px 4px">Видео упражнений — из прошлой версии приложения. Схемы тяги гантели и гакк-приседа: Everkinetic, CC BY-SA 3.0</p>';
  return h;
}

/* ---------- Лист ---------- */
// Окна и тренировка пишутся в историю браузера: системная «Назад» закрывает их, а не приложение
function depthOf(st) { st = st || {}; return (st.r ? 1 : 0) + (st.s ? 1 : 0); }
function sheet(html) {
  var el = $('sheet');
  if (el.hidden) history.pushState({ r: !!R, s: 1 }, '');
  el.innerHTML = '<div class="pane" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>'; el.hidden = false;
}
function hideSheet() { $('sheet').hidden = true; $('sheet').innerHTML = ''; }
function closeSheet() { if ($('sheet').hidden) return; hideSheet(); if (history.state && history.state.s) history.back(); }
window.addEventListener('popstate', function (e) {
  var st = e.state || {};
  if (!st.s && !$('sheet').hidden) hideSheet();
  if (!st.r && R) { if (R.phase !== 'sum') toast('Прогресс сохранён'); stopRunReal(); }
});
function pickSheet() {
  sheet('<h2>Какую тренировку делаем?</h2><p class="t2 sm" style="margin-top:4px">Обычно дни идут по кругу. Выбери другую, если так удобнее</p><div style="margin-top:10px">' +
    ['A', 'B', 'C'].map(function (k) {
      return '<button class="exl" data-a="go" data-v="' + k + '"><span class="th dn">' + k + '</span><div><b>' + esc(DAYS[k].t) + '</b><small>' + DAYS[k].list.length + ' упражнений · ~' + minutes(k) + ' мин</small></div>' + ic('next') + '</button>';
    }).join('') + '</div>');
}
// Одна тренировка из истории: можно поправить любой подход, продолжить или удалить
function histSheet(d) {
  var L = S.log[d]; if (!L) { closeSheet(); return; }
  var st = totals(L), order = DAYS[L.day].list.map(function (it) { return it.e; }), ex = L.ex || {};
  // сначала в порядке дня, потом то, чего в дне уже нет (старая версия программы)
  var ids = order.concat(Object.keys(ex).filter(function (id) { return order.indexOf(id) < 0; })).filter(function (id) { return EX[id] && ex[id] && ex[id].some(Boolean); });
  sheet('<span class="eyebrow">' + dayName(d) + (L.done ? '' : ' · не закончена') + '</span><h2 style="margin-top:6px">' + esc(DAYS[L.day].t) + '</h2>' +
    '<p class="t2 sm" style="margin-top:4px">' + st.sets + ' ' + plural(st.sets, 'подход', 'подхода', 'подходов') + ' · ' + Math.round(st.ton).toLocaleString('ru') + ' кг' + (L.cardio ? ' · ходьба' : '') + '</p>' +
    '<div style="margin-top:10px">' + (ids.length ? ids.map(function (id) {
      return '<div class="hx"><b>' + esc(EX[id].n) + '</b><div class="sets">' + L.ex[id].map(function (s, k) {
        return s ? '<button class="set" data-a="eset" data-v="' + d + '|' + id + '|' + k + '">' + (EX[id].inc ? s[0] + ' × ' : '') + s[1] + '</button>' : '';
      }).join('') + '</div></div>';
    }).join('') : '<p class="t2 sm">Подходов нет</p>') + '</div><p class="t3 xs" style="margin-top:10px">Нажми на подход, чтобы исправить или удалить</p>' +
    (d === TODAY ? '<button class="pb wide" style="margin-top:16px" data-a="' + (L.done ? 'reopen' : 'go') + '" data-v="' + L.day + '">' + ic('play') + 'Продолжить тренировку</button>' : '') +
    '<button class="lnk" style="color:#E7806A" data-a="delw" data-v="' + d + '">Удалить тренировку</button>');
}
function setSheet(d, id, k) {
  var s = S.log[d].ex[id][k], x = EX[id];
  sheet('<span class="eyebrow">' + dayName(d) + ' · подход ' + (k + 1) + '</span><h2 style="margin-top:6px">' + esc(x.n) + '</h2><div class="fields">' +
    (x.inc ? stepper('ekg', s[0], 'вес, кг', x.inc) : '') + stepper('erp', s[1], 'повторов', 1) + '</div>' +
    '<button class="pb wide" style="margin-top:18px" data-a="saveset" data-v="' + d + '|' + id + '|' + k + '">Сохранить</button>' +
    '<button class="lnk" style="color:#E7806A" data-a="delset" data-v="' + d + '|' + id + '|' + k + '">Удалить подход</button>');
}
function wlistSheet() {
  var ds = Object.keys(S.body).sort().reverse();
  sheet('<h2>Все замеры</h2><div style="margin-top:8px">' + (ds.length ? ds.map(function (d) {
    var b = S.body[d];
    return '<div class="wrow"><span>' + dayName(d) + '</span><span>' + (b.w ? b.w + ' кг' : '') + '</span><span class="t2">' + (b.waist ? b.waist + ' см' : '') + '</span>' +
      '<button class="ib" data-a="delbody" data-v="' + d + '" aria-label="Удалить замер ' + dayName(d) + '">' + ic('x') + '</button></div>';
  }).join('') : '<p class="t2 sm">Замеров пока нет</p>') + '</div>');
}
// Тренировки с сегодня до конца 21 дня (минимум 3 недели вперёд) → .ics для Календаря
function exportIcs() {
  var time = S.rtime || '18:00', end = addDays(S.start, 20), url = location.href.split('#')[0], range = [];
  if (end < addDays(TODAY, 20)) end = addDays(TODAY, 20);
  for (var d = TODAY; d <= end; d = addDays(d, 1)) range.push(d);
  var sc = schedule(range, TODAY, S.log, S.train);
  var ev = range.filter(function (d) { return sc[d].st === 'plan' || sc[d].st === 'today'; }).map(function (d) {
    var D = DAYS[sc[d].day];
    return { date: d, time: time, min: minutes(sc[d].day), title: 'Тренировка ' + sc[d].day + ' · ' + D.t,
      desc: D.list.map(function (it) { return '• ' + EX[it.e].n; }).join('\n') + '\n\nОткрыть: ' + url };
  });
  if (!ev.length) { toast('Нет запланированных тренировок'); return; }
  var txt = icsCal(ev, 30, new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z');
  var blob = new Blob([txt], { type: 'text/calendar;charset=utf-8' }), href = URL.createObjectURL(blob);
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) location.href = href; // iOS сам предложит «Добавить всё» в Календарь
  else { var lk = document.createElement('a'); lk.href = href; lk.download = 'zal-21.ics'; document.body.appendChild(lk); lk.click(); lk.remove(); }
  toast(ev.length + ' ' + plural(ev.length, 'тренировка', 'тренировки', 'тренировок') + ' — открой файл и нажми «Добавить всё»');
}
/* ---------- Уведомления на экран блокировки через ntfy ---------- */
// Свёрнутый сайт на iPhone не умеет ни считать время, ни вибрировать. Бесплатное приложение ntfy получает
// отложенное сообщение и показывает его на экране блокировки с обычной вибрацией айфона.
// Запланированное сообщение ntfy отменить нельзя (проверено) — поэтому отдых планируем, только когда приложение уходит в фон
var NTFY = 'https://ntfy.sh/';
function ntfy(seq, delaySec, title, msg) {
  if (!S.nt) return;
  var q = '?title=' + encodeURIComponent(title) + '&message=' + encodeURIComponent(msg) + '&priority=4&tags=muscle' +
    '&click=' + encodeURIComponent(location.href.split('#')[0]) + (delaySec ? '&delay=' + Math.round(delaySec) + 's' : '');
  fetch(NTFY + S.nt + '/' + seq + q, { method: 'POST', keepalive: true }).catch(function () {});
}
function ntfyClear(seq) { if (S.nt && seq) fetch(NTFY + S.nt + '/' + seq, { method: 'DELETE', keepalive: true }).catch(function () {}); }
// Ушёл из приложения во время отдыха или ходьбы — уведомление на момент окончания
function ntfyRest() {
  if (!S.nt || !R || !R.end || !S.rt) return;
  var left = (R.end - Date.now()) / 1e3, seq = 't' + R.end;
  if (left < 10 || S.rt.p === seq) return; // меньше 10 с ntfy не планирует; уже отправили — не дублируем
  var np = R.phase === 'rest' ? pos() : null, nx = np && DAYS[R.day].list[np.i];
  ntfy(seq, left, R.phase === 'rest' ? 'Отдых окончен' : 'Ходьба окончена',
    nx ? 'Дальше: ' + EX[nx.e].n + ', подход ' + (np.s + 1) + ' из ' + setsOf(R.day, np.i) : 'Нажми «Готово», чтобы сохранить тренировку');
  S.rt.p = seq; save();
}
// «Сегодня тренировка» за 30 минут до выбранного времени — на 3 дня вперёд (дальше ntfy не планирует)
function ntfyDays() {
  if (!S.nt) return;
  var range = [TODAY, addDays(TODAY, 1), addDays(TODAY, 2)], sc = schedule(range, TODAY, S.log, S.train), t = (S.rtime || '18:00').split(':');
  S.ntd = S.ntd || {};
  Object.keys(S.ntd).forEach(function (d) { if (d < TODAY) delete S.ntd[d]; });
  range.forEach(function (d) {
    if (S.ntd[d] || !(sc[d].st === 'plan' || sc[d].st === 'today')) return;
    var at = new Date(d + 'T00:00:00'); at.setHours(+t[0], +t[1] - 30, 0, 0);
    var delay = (at - Date.now()) / 1e3;
    if (delay < 10 || delay > 3 * 86400 - 60) return;
    ntfy('day-' + d, delay, 'Сегодня тренировка ' + sc[d].day, DAYS[sc[d].day].t + ' в ' + (S.rtime || '18:00') + ' · ~' + minutes(sc[d].day) + ' мин');
    S.ntd[d] = 1;
  });
  save();
}
function ntSheet() {
  sheet('<h2>Уведомления на экран блокировки</h2><p class="t2 sm" style="margin-top:6px">Конец отдыха и «сегодня тренировка» — с вибрацией, даже когда телефон в кармане. Через бесплатное приложение ntfy</p>' +
    '<ol><li>Установи <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener" style="color:var(--ac2)">ntfy из App Store</a> (на Android — из Google Play)</li>' +
    '<li>В ntfy нажми «+» и вставь название канала:<div class="sets" style="margin-top:8px"><span class="set" style="display:inline-flex;align-items:center;user-select:all">' + esc(S.nt) + '</span><button class="set" data-a="ntcopy">Скопировать</button></div></li>' +
    '<li>Разреши ntfy присылать уведомления</li><li>Нажми «Проверить» и заблокируй телефон — через 10 секунд придёт уведомление</li></ol>' +
    '<button class="pb wide" data-a="nttest">Проверить</button>' +
    '<p class="t3 xs" style="margin-top:12px">Пока приложение открыто, уведомлений нет — ты и так видишь таймер. Название канала случайное, в сообщениях только упражнение и время</p>' +
    '<button class="lnk" style="color:#E7806A" data-a="ntoff">Отключить уведомления</button>');
}
// После правки данных — пересчитать, где мы в тренировке. reset: после «Отменить» таймер отдыха не сохраняем
function syncRun(reset) {
  if (!R) return;
  var L = S.log[TODAY];
  if (!L) { stopRun(); return; }
  L.ex = L.ex || {}; L.skip = L.skip || [];
  var keepRest = !reset && R.phase === 'rest' && R.end;
  R.day = L.day; R.jump = null;
  R.phase = L.done ? 'sum' : pos() ? (keepRest ? 'rest' : 'work') : 'cardio';
  if (R.phase !== 'rest') R.end = null;
  renderRun();
}
function exSheet(id) {
  var x = EX[id];
  sheet(stage(id, false) + '<div class="center"><span class="eyebrow">' + esc(x.m) + '</span><h2 style="margin-top:6px">' + esc(x.n) + '</h2></div>' +
    '<h3>Как делать</h3><ol>' + x.how.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
    '<h3>Частые ошибки</h3><ul>' + x.err.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
    (x.alt ? '<h3>Если тренажёр занят</h3><ul>' + x.alt.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
    '<button class="pb wide" data-a="close">Понятно</button>');
}
function weighSheet() {
  var t = S.body[TODAY] || {}, ws = weights(), lw = t.w || (ws.length ? ws[ws.length - 1][1] : S.prof.w);
  var wd = Object.keys(S.body).sort().filter(function (k) { return S.body[k].waist; });
  sheet('<h2>Замер за сегодня</h2><p class="t2 sm" style="margin-top:4px">Утром, натощак, после туалета</p><div class="fields">' +
    stepper('bw', lw, 'вес, кг', 0.1) + stepper('waist', t.waist || (wd.length ? S.body[wd[wd.length - 1]].waist : ''), 'талия по пупку, см · раз в неделю', 0.5) +
    '</div><button class="pb wide" style="margin-top:18px" data-a="saveW">Сохранить</button>' +
    (S.body[TODAY] ? '<button class="lnk" style="color:#E7806A" data-a="delbody" data-v="' + TODAY + '">Удалить замер за сегодня</button>' : ''));
}
function profSheet() {
  var P = S.prof;
  sheet('<h2>Мои данные</h2><div class="fields">' + stepper('h', P.h, 'рост, см', 1) + stepper('age', P.age, 'возраст', 1) + stepper('w', P.w, 'вес, кг', 0.5) +
    '</div><p class="t2 sm" style="margin-top:12px">Обновляй вес каждые −5 кг — норма пересчитается</p><button class="pb wide" style="margin-top:16px" data-a="saveP">Сохранить</button>');
}
function readProf() {
  var P = { h: num('h'), age: num('age'), w: num('w') };
  if (!(P.h >= 120 && P.h <= 230 && P.age >= 14 && P.age <= 90 && P.w >= 35 && P.w <= 300)) { toast('Проверь рост, возраст и вес'); return null; }
  return P;
}

/* ---------- Тренировка ---------- */
function startRun(day) {
  var L = S.log[TODAY] = S.log[TODAY] || {};
  if (!L.day || !L.ex || !Object.keys(L.ex).length) L.day = day;
  L.ex = L.ex || {}; L.skip = L.skip || []; save();
  if (!R) {
    // из окна выбора — заменяем запись окна на тренировку, иначе асинхронный back() закрыл бы её
    if (!$('sheet').hidden) { hideSheet(); history.replaceState({ r: 1 }, ''); } else history.pushState({ r: 1 }, '');
  } else hideSheet();
  R = { day: L.day, phase: 'work', jump: null };
  if (!pos()) R.phase = L.done ? 'sum' : 'cardio';
  // таймер, сохранённый до выгрузки приложения: продолжаем с правильным остатком
  var rt = S.rt;
  if (rt && rt.d === TODAY && rt.day === L.day && totals(L).sets && !L.done && rt.end > Date.now() && (rt.ph === 'rest' ? R.phase === 'work' : R.phase === 'cardio')) { R.phase = rt.ph; R.end = rt.end; R.len = rt.len; }
  else if (rt) { delete S.rt; save(); }
  $('run').hidden = false; document.body.style.overflow = 'hidden'; document.body.classList.add('running');
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
  renderRun();
}
function stopRun() { var n = depthOf(history.state); hideSheet(); stopRunReal(); if (n) history.go(-n); }
function stopRunReal() {
  clearInterval(timer); R = null; $('run').hidden = true; $('run').innerHTML = ''; document.body.style.overflow = ''; document.body.classList.remove('running');
  if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
  render();
}
function pos() {
  var L = S.log[TODAY], list = DAYS[R.day].list;
  function at(i) { var n = (L.ex[list[i].e] || []).filter(Boolean).length; return n < setsOf(R.day, i) && L.skip.indexOf(list[i].e) < 0 ? { i: i, s: n } : null; }
  if (R.jump !== null) { var j = at(R.jump); if (j) return j; R.jump = null; }
  for (var i = 0; i < list.length; i++) { var p = at(i); if (p) return p; }
  return null;
}
// Вся тренировка как матрица точек: каждый подход — две колонки, высота — тяжесть упражнения
function matrix(cur) {
  var L = S.log[TODAY], list = DAYS[R.day].list, cols = '', all = 0, done = 0;
  list.forEach(function (it, i) {
    var tot = setsOf(R.day, i), n = (L.ex[it.e] || []).filter(Boolean).length, sk = L.skip.indexOf(it.e) >= 0, base = it.rest >= 150 ? 6 : it.rest >= 120 ? 5 : it.rest >= 90 ? 4 : 3;
    for (var s = 0; s < tot; s++) {
      all++; if (s < n) done++;
      var st = s < n ? 'd' : cur && cur.i === i && cur.s === s ? 'n' : '';
      for (var c = 0; c < 2; c++) {
        var hgt = base + ((s + c) % 2) + (sk ? -1 : 0);
        cols += '<span class="c ' + st + '">' + (st === 'n' && c === 0 ? '<b class="ph"></b>' : '') + new Array(Math.max(2, hgt) + 1).join('<i></i>') + '</span>';
      }
    }
  });
  return '<div class="mtx" aria-hidden="true">' + cols + '</div><div class="mtx-l"><span>Сделано ' + done + ' из ' + all + ' подходов</span><span>' + ic('walk').replace('class="i"', 'class="i" style="width:12px;height:12px;vertical-align:-2px"') + ' + ходьба</span></div>';
}
function renderRun() {
  clearInterval(timer);
  var list = DAYS[R.day].list, L = S.log[TODAY], w = W(), h;
  var top = function (title, tools) {
    return '<div class="rtop"><button class="ib" data-a="exit" aria-label="Выйти, прогресс сохранится">' + ic('back') + '</button><b>' + title + '</b>' +
      (tools ? '<button class="ib" data-a="exlist" aria-label="Все упражнения">' + ic('more') + '</button>' : '<span style="width:40px"></span>') + '</div>';
  };
  if (R.phase === 'work') {
    var p = pos(), it = list[p.i], x = EX[it.e], total = setsOf(R.day, p.i);
    var last = lastSets(it.e), hi = hint(last, it.r[0], it.r[1], x.inc), done = (L.ex[it.e] || []).filter(Boolean), prev = done[done.length - 1];
    var kg = prev ? prev[0] : hi.kg !== undefined ? hi.kg : '', reps = prev ? prev[1] : it.r[0];
    var tip = !x.inc ? 'Цель — ' + it.r[1] + ' повторов. Легко — делай медленнее'
      : hi.t === 'new' ? 'Первый раз: подбери вес, чтобы мог сделать ещё ' + w.rir + ' раза'
      : hi.t === 'up' ? '<span class="tip-up">Прибавляем до ' + hi.kg + ' кг</span> — в прошлый раз ты сделал всё'
      : hi.t === 'down' ? 'Оставь ' + hi.kg + ' кг, постарайся сделать хотя бы ' + it.r[0]
      : hi.kg + ' кг — попробуй на 1 повтор больше, чем в прошлый раз';
    if (p.s === 0 && p.i < 3) tip += '. Перед этим — 2 лёгких разминочных подхода';
    var fm = failMode(it, p.s, total);
    if (fm && (hi.t === 'new' || prev)) tip = 'Вес как в прошлом подходе — работай до предела'; // «оставь в запасе» тут противоречит отказу
    h = '<div class="in' + (fm ? ' fl' : '') + '">' + top('Упражнение ' + (p.i + 1) + ' из ' + list.length, true) + stage(it.e, true) +
      '<div class="ex-cap"><span class="eyebrow">Подход ' + (p.s + 1) + ' из ' + total + (fm ? ' · до отказа' : '') + '</span><h2>' + esc(x.n) + '</h2><p>' + tip + '</p>' +
      (fm ? '<div class="fail"><b>' + ic('flame') + esc(fm.t) + '</b><span>' + esc(fm.d) + '</span></div>' : '') +
      '<div class="meta"><span>' + ic('repeat') + it.r[0] + '–' + it.r[1] + ' повторов</span><span>' + ic('target') +
      (fm ? 'до отказа' : (it.f === 'no' ? Math.max(1, w.rir) : w.rir) + ' в запасе' + (it.f === 'no' && w.fail ? ', без отказа' : '')) + '</span><span>' + ic('clock') + 'отдых ' + mmss(it.rest) + '</span></div></div>' +
      matrix(p) + (done.length ? '<div class="sets done-row"><span class="t3 xs">Сделано:</span>' + L.ex[it.e].map(function (s, k) {
        return s ? '<button class="set" data-a="eset" data-v="' + TODAY + '|' + it.e + '|' + k + '" aria-label="Исправить подход ' + (k + 1) + '">' + (x.inc ? s[0] + ' × ' : '') + s[1] + '</button>' : '';
      }).join('') + '</div>' : '') +
      '<div class="duo">' + (x.inc ? stepper('kg', kg, 'вес, кг', x.inc) : '') + stepper('reps', reps, 'сделал раз', 1) + '</div>' +
      '<div class="grow"></div><div class="foot"><div class="pair"><button class="pb gh" data-a="skip" data-v="' + it.e + '">' + ic('skip') + 'Пропустить</button>' +
      '<button class="pb" data-a="set" data-v="' + p.i + '">' + ic('check') + 'Подход сделан</button></div></div>';
  } else if (R.phase === 'rest' || R.phase === 'cardio') {
    var np = pos(), nx = np ? list[np.i] : null, card = R.phase === 'cardio';
    h = '<div class="in sky grain calm">' + top(card ? 'Финиш' : 'Отдых', true) +
      '<div class="grow"></div><div class="center"><div class="gw">' + arc(1, 'gr', true, 'ra') +
      '<div class="v"><span class="num-xl" id="rt">' + (card ? '15:00' : mmss(R.len)) + '</span></div></div>' +
      '<span class="eyebrow" id="rs" style="margin-top:14px">' + (card ? 'ходьба в горку' : 'отдыхай') + '</span>' +
      (S.nt && R.end ? '<div class="t3 xs" style="margin-top:10px">' + ic('moon').replace('class="i"', 'class="i" style="width:12px;height:12px;vertical-align:-2px"') + ' Можно заблокировать телефон — уведомление придёт на экран блокировки</div>' : '') +
      (card ? '<h2 style="margin-top:8px">15 минут ходьбы</h2><p class="t2 sm" style="margin:6px auto 0;max-width:300px">Беговая дорожка: наклон 10%, 5 км/ч. Дыши ровно — так, чтобы мог говорить</p>'
        : nx ? '<button class="nx" data-a="restdone">' + thumb(nx.e) + '<div><div class="t3 xs">Дальше</div><div>' + esc(EX[nx.e].n) + '</div><div class="t2 xs">подход ' + (np.s + 1) + ' из ' + setsOf(R.day, np.i) + '</div></div></button>' : '') +
      (!card && R.last && L.ex[R.last.id] && L.ex[R.last.id][R.last.k] ? '<button class="lnk" data-a="eset" data-v="' + TODAY + '|' + R.last.id + '|' + R.last.k + '">Записано ' +
        (EX[R.last.id].inc ? L.ex[R.last.id][R.last.k][0] + ' кг × ' : '') + L.ex[R.last.id][R.last.k][1] + ' — исправить</button>' : '') +
      '</div><div class="grow"></div><div class="foot">' +
      (card ? (R.end ? '<div class="pair"><button class="pb gh" data-a="cardio" data-v="0">Пропустить</button><button class="pb" data-a="cardio" data-v="1">' + ic('check') + 'Готово</button></div>' : '<div class="pair"><button class="pb gh" data-a="cardio" data-v="0">Пропустить</button><button class="pb play" data-a="cstart">' + ic('play') + 'Старт</button></div>')
        : '<div class="pair"><button class="pb gh" data-a="add30">+30 сек</button><button class="pb" data-a="restdone">Дальше</button></div>') + '</div>';
  } else {
    h = '<div class="in sky grain">' + summary(true);
  }
  $('run').innerHTML = h + '</div>';
  $('run').scrollTop = 0;
  if (R.end) { timer = setInterval(tickRun, 200); tickRun(); }
}
function tickRun() {
  if (!R || !R.end) return;
  var left = Math.max(0, (R.end - Date.now()) / 1e3);
  setArc('ra', left / R.len);
  if ($('rt')) $('rt').textContent = mmss(Math.ceil(left));
  if (!left) {
    clearInterval(timer); R.end = null;
    if ($('rs')) $('rs').textContent = R.phase === 'rest' ? 'пора — следующий подход' : 'готово';
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]); // Android; iPhone вибрирует через уведомление ntfy
    if (S.rt && S.rt.p) ntfyClear(S.rt.p); // уже на экране — убираем пришедшее уведомление
    if (R.phase === 'rest') { delete S.rt; save(); }
  }
}
function logSet(i) {
  var it = DAYS[R.day].list[i], x = EX[it.e], kg = x.inc ? num('kg') : 0, reps = Math.round(num('reps'));
  if (x.inc && !(kg > 0)) { toast('Укажи вес'); return; }
  if (!(reps > 0)) { toast('Укажи, сколько раз сделал'); return; }
  var L = S.log[TODAY];
  act('Записано: ' + (x.inc ? kg + ' кг × ' : '') + reps, function () {
    var arr = L.ex[it.e] = (L.ex[it.e] || []).filter(Boolean);
    arr.push([kg, reps]); L.t0 = L.t0 || Date.now();
    R.last = { id: it.e, k: arr.length - 1 };
  });
  R.jump = null;
  if (!pos()) { R.phase = 'cardio'; R.end = null; }
  else { R.phase = 'rest'; R.len = it.rest; R.end = Date.now() + it.rest * 1e3; S.rt = { d: TODAY, day: R.day, end: R.end, len: R.len, ph: 'rest' }; save(); }
  renderRun();
}
function finish(cardio) {
  var L = S.log[TODAY];
  act('Тренировка сохранена', function () { L.cardio = cardio; L.done = true; L.t1 = Date.now(); delete S.rt; });
  R.phase = 'sum'; R.end = null; renderRun();
}
function summary(inRun) {
  var L = S.log[TODAY], sets = 0, ton = 0, rec = 0, had = 0;
  Object.keys(L.ex || {}).forEach(function (id) {
    var a = L.ex[id].filter(Boolean), prev = lastSets(id);
    a.forEach(function (s) { sets++; ton += s[0] * s[1]; });
    if (prev) had++;
    if (prev && a.length && EX[id].inc && Math.max.apply(null, a.map(function (s) { return s[0]; })) > Math.max.apply(null, prev.map(function (s) { return s[0]; }))) rec++;
  });
  var min = L.t0 && L.t1 ? Math.max(1, Math.round((L.t1 - L.t0) / 6e4)) : null;
  return (inRun ? '<div class="rtop"><span style="width:40px"></span><b>Итог</b><span style="width:40px"></span></div><div class="grow"></div>' : '') +
    '<div class="center"><div class="gw">' + arc(1, 'gs', true) + '<div class="v"><span class="num-xl">' + sets + '<small> ' + plural(sets, 'подход', 'подхода', 'подходов') + '</small></span></div></div>' +
    '<span class="eyebrow" style="margin-top:14px">' + esc(DAYS[L.day].t) + (L.cardio ? ' · ходьба' : '') + '</span><h1 style="margin-top:6px">Тренировка выполнена</h1>' +
    '<div class="sumg"><div><b>' + Math.round(ton).toLocaleString('ru') + '</b><span>кг поднято всего</span></div>' +
    '<div><b>' + (min || '—') + '</b><span>' + (min ? plural(min, 'минута', 'минуты', 'минут') : 'минут') + '</span></div>' +
    (had ? '<div style="grid-column:1/-1"><b>' + rec + '</b><span>' + plural(rec, 'упражнение', 'упражнения', 'упражнений') + ' с новым весом</span></div>'
      : '<div style="grid-column:1/-1"><b>1-я</b><span>тренировка дня ' + L.day + ' — веса запомнены, в следующий раз подскажу прибавку</span></div>') + '</div></div>' +
    (inRun ? '<div class="grow"></div><div class="foot"><button class="pb wide" data-a="exit">Готово</button><button class="lnk" data-a="reopen">Вернуться к тренировке</button></div>'
      : '<button class="pb wide" style="margin-top:18px" data-a="close">Готово</button><button class="lnk" data-a="hist" data-v="' + TODAY + '">Посмотреть и исправить подходы</button>');
}
function exList() {
  var L = S.log[TODAY], list = DAYS[R.day].list, p = R.phase === 'work' ? pos() : null;
  sheet('<h2>' + esc(DAYS[R.day].t) + '</h2><p class="t2 sm" style="margin-top:4px">Тренажёр занят? Выбери другое упражнение и вернись позже</p><div style="margin-top:8px">' + list.map(function (it, i) {
    var n = (L.ex[it.e] || []).filter(Boolean).length, tot = setsOf(R.day, i), sk = L.skip.indexOf(it.e) >= 0;
    return '<button class="exl" data-a="jump" data-v="' + i + '">' + thumb(it.e) + '<div><b>' + esc(EX[it.e].n) + '</b><small>' + (sk ? 'пропущено — нажми, чтобы вернуть' : n + ' из ' + tot + ' подходов') + '</small></div>' + ic(n >= tot ? 'check' : 'next') + '</button>';
  }).join('') + '</div>' +
    (!totals(L).sets ? '<h3>Другая тренировка</h3><div class="seg" style="margin-top:8px">' + ['A', 'B', 'C'].map(function (k) {
      return '<button class="' + (k === R.day ? 'on' : '') + '" data-a="swap" data-v="' + k + '">День ' + k + '</button>';
    }).join('') + '</div>' : '') +
    (R.phase !== 'sum' ? '<button class="pb gh wide" style="margin-top:18px" data-a="cardio" data-v="0">Закончить сейчас</button><button class="lnk" style="color:#E7806A" data-a="cancelw">Отменить тренировку</button>' : ''));
}

/* ---------- События ---------- */
document.addEventListener('click', function (e) {
  if (e.target.id === 'sheet') { closeSheet(); return; }
  var b = e.target.closest('[data-a],[data-t]'); if (!b) return;
  var a = b.dataset.a, v = b.dataset.v;
  if (b.dataset.t) {
    if (b.dataset.t === 'go') { var L0 = S.log[TODAY] || {}; if (L0.done) { tab = 'home'; render(); sheet(summary(false)); } else startRun(L0.day || nextPlanned()); return; }
    tab = b.dataset.t; render(); window.scrollTo(0, 0); return;
  }
  if (a === 'undo') { undo(); return; }
  // клик, который браузер шлёт сразу после свайпа по датам, — не выбор дня
  if (a === 'sel') { if (Date.now() < swallowUntil && b.closest('.dates')) return; sel = v; render(); return; }
  if (a === 'pplan') { planDay = v; tab = 'plan'; render(); window.scrollTo(0, 0); return; }
  if (a === 'ob') {
    if (ob === 1) { var P = readProf(); if (!P && +v > ob) return; if (P) S.prof = P; } // назад — без проверки, данные не теряем
    if (ob === 2) S.train = S.train || [1, 3, 5];
    ob = Math.max(0, +v); render(); window.scrollTo(0, 0);
  }
  else if (a === 'obdone') { S.onb = 1; S.train = S.train || [1, 3, 5]; if (!Object.keys(S.log).length) S.start = TODAY; if (v) S.photo1 = true; save(); render(); }
  else if (a === 'train') { S.train = v.split(',').map(Number); save(); render(); }
  else if (a === 'inc') { var el = $('f_' + b.dataset.k), cur = parseFloat(String(el.value).replace(',', '.')); el.value = Math.max(0, r1((isNaN(cur) ? 0 : cur) + parseFloat(b.dataset.d))); }
  else if (a === 'go') startRun(v);
  else if (a === 'hab') { var H = S.hab[TODAY] = S.hab[TODAY] || {}; H[v] = !H[v]; save(); render(); }
  else if (a === 'photo') { act('Отмечено: фото сделано', function () { S[dayNo() === 1 ? 'photo1' : 'photo2'] = true; }); render(); }
  else if (a === 'summary') sheet(summary(false));
  else if (a === 'pick') pickSheet();
  else if (a === 'hist') histSheet(v);
  else if (a === 'weigh') weighSheet();
  else if (a === 'wlist') wlistSheet();
  else if (a === 'saveW') {
    var w = num('bw'), wa = num('waist');
    if (!(w >= 35 && w <= 300) && !(wa >= 40 && wa <= 250)) { toast('Проверь цифры'); return; }
    act('Замер записан', function () {
      var o = S.body[TODAY] = {};
      if (w >= 35 && w <= 300) o.w = r1(w);
      if (wa >= 40 && wa <= 250) o.waist = r1(wa);
    });
    closeSheet(); render();
  }
  else if (a === 'delbody') {
    var listOpen = !!document.querySelector('#sheet .wrow');
    act('Замер удалён', function () { delete S.body[v]; });
    if (listOpen) wlistSheet(); else closeSheet();
    render();
  }
  else if (a === 'eset') { var q = v.split('|'); editFrom = !!document.querySelector('#sheet .hx'); setSheet(q[0], q[1], +q[2]); }
  else if (a === 'saveset' || a === 'delset') {
    var q2 = v.split('|'), Ld = S.log[q2[0]], arr2 = Ld.ex[q2[1]], kk = +q2[2], xx = EX[q2[1]];
    if (a === 'saveset') {
      var nk = xx.inc ? num('ekg') : 0, nr = Math.round(num('erp'));
      if (xx.inc && !(nk > 0) || !(nr > 0)) { toast('Проверь вес и повторы'); return; }
      act('Подход исправлен', function () { arr2[kk] = [r1(nk), nr]; });
    } else {
      act('Подход удалён', function () { arr2.splice(kk, 1); if (!arr2.length) delete Ld.ex[q2[1]]; });
    }
    if (editFrom) histSheet(q2[0]); else closeSheet();
    if (q2[0] === TODAY) syncRun();
    render();
  }
  else if (a === 'delw') {
    act('Тренировка удалена', function () { delete S.log[v]; if (v === TODAY) delete S.rt; });
    if (v === TODAY && R) stopRun(); else { closeSheet(); render(); }
  }
  else if (a === 'reopen') {
    act('Тренировка снова открыта', function () { var L3 = S.log[TODAY]; L3.done = false; delete L3.t1; delete L3.cardio; });
    if (R) syncRun(); else startRun(S.log[TODAY].day);
  }
  else if (a === 'swap') { S.log[TODAY].day = v; save(); closeSheet(); syncRun(); }
  else if (a === 'ics') exportIcs();
  else if (a === 'nt') {
    if (S.nt) { ntSheet(); return; }
    var rnd = new Uint8Array(9); crypto.getRandomValues(rnd); // случайный канал: по нему тебя никто не найдёт
    S.nt = 'zal21-' + Array.prototype.map.call(rnd, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    save(); render(); ntSheet(); ntfyDays();
  }
  else if (a === 'nthelp') ntSheet();
  else if (a === 'ntcopy') { (navigator.clipboard ? navigator.clipboard.writeText(S.nt) : Promise.reject()).then(function () { toast('Скопировано'); }, function () { toast('Выдели название и скопируй вручную'); }); }
  else if (a === 'nttest') { ntfy('test-' + Date.now(), 10, 'Зал', 'Уведомления работают — так придёт конец отдыха'); toast('Через 10 секунд придёт уведомление — заблокируй телефон'); }
  else if (a === 'ntoff') { delete S.nt; delete S.ntd; save(); closeSheet(); render(); toast('Уведомления отключены'); }
  else if (a === 'cancelw') { act('Тренировка отменена', function () { delete S.log[TODAY]; delete S.rt; }); stopRun(); }
  else if (a === 'prof') profSheet();
  else if (a === 'saveP') { var P2 = readProf(); if (!P2) return; S.prof = P2; save(); closeSheet(); render(); toast('Норма пересчитана'); }
  else if (a === 'pday') { planDay = v; render(); }
  else if (a === 'ex') exSheet(v);
  else if (a === 'close') closeSheet();
  else if (a === 'exp') { var lk = document.createElement('a'); lk.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); lk.download = 'zal-' + TODAY + '.json'; lk.click(); }
  else if (a === 'imp') $('impf').click();
  else if (a === 'wipe') { if (confirm('Удалить все записи и начать заново? Сначала можно сохранить копию.')) { localStorage.removeItem(KEY); location.reload(); } }
  else if (a === 'set') logSet(+v);
  else if (a === 'skip') { act('Упражнение пропущено', function () { S.log[TODAY].skip.push(v); delete S.rt; }); closeSheet(); R.jump = null; R.end = null; if (!pos()) R.phase = 'cardio'; renderRun(); }
  else if (a === 'exlist') exList();
  else if (a === 'jump') {
    var L2 = S.log[TODAY], id = DAYS[R.day].list[+v].e, k = L2.skip.indexOf(id);
    if (k >= 0) L2.skip.splice(k, 1);
    save(); closeSheet(); R.jump = +v; R.end = null; if (pos()) R.phase = 'work'; renderRun();
  }
  else if (a === 'add30') { R.end = (R.end || Date.now()) + 30e3; R.len = Math.max(R.len, Math.ceil((R.end - Date.now()) / 1e3)); S.rt = { d: TODAY, day: R.day, end: R.end, len: R.len, ph: R.phase }; save(); clearInterval(timer); timer = setInterval(tickRun, 200); tickRun(); }
  else if (a === 'restdone') { R.end = null; delete S.rt; save(); R.phase = pos() ? 'work' : 'cardio'; renderRun(); }
  else if (a === 'cstart') { R.len = 900; R.end = Date.now() + 900e3; S.rt = { d: TODAY, day: R.day, end: R.end, len: 900, ph: 'cardio' }; save(); renderRun(); }
  else if (a === 'cardio') { closeSheet(); finish(v === '1'); }
  else if (a === 'exit') { if (R && R.phase !== 'sum') toast('Прогресс сохранён — нажми «Продолжить» на главной'); stopRun(); }
});
function nextPlanned() { return schedule(weekDates(TODAY), TODAY, S.log, S.train)[TODAY].day || nextLetter(); }
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.id === 'sd' && t.value) { S.start = t.value; save(); render(); }
  else if (t.id === 'rtime' && t.value) { S.rtime = t.value; save(); }
  else if (t.id === 'impf' && t.files[0]) {
    t.files[0].text().then(function (txt) {
      var d = JSON.parse(txt);
      if (!d || typeof d !== 'object' || !d.start || !d.log) throw 0;
      if (confirm('Заменить текущие записи данными из файла?')) { localStorage.setItem(KEY, txt); location.reload(); }
    }).catch(function () { toast('Это не файл копии этого приложения'); });
  }
});
// Свайп по датам: палец тянет дуги, отпустил — сдвиг на столько дней, сколько протянул (54px = день)
document.addEventListener('pointerdown', function (e) { var el = e.target.closest('.dates'); if (el) drag = { x: e.clientX, el: el }; });
document.addEventListener('pointermove', function (e) { if (drag) drag.el.style.transform = 'translateX(' + (e.clientX - drag.x) + 'px)'; });
function endDrag(e) {
  if (!drag) return;
  var dx = e.clientX - drag.x; drag.el.style.transform = ''; drag = null;
  if (Math.abs(dx) < 24) return;
  sel = addDays(sel, -Math.round(dx / 54) || (dx < 0 ? 1 : -1)); swallowUntil = Date.now() + 350; render();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', function () { if (drag) { drag.el.style.transform = ''; drag = null; } });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { ntfyRest(); return; } // ушёл в фон — пусть ntfy напомнит об окончании отдыха
  var now = iso(new Date());
  ntfyDays();
  if (now !== TODAY && !R) { if (sel === TODAY) sel = now; TODAY = now; render(); }
  if (R) tickRun();
  if (R && navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
});

render();
// приложение выгрузили во время отдыха или ходьбы — открываем тренировку сразу
ntfyDays();
if (S.onb && S.rt && S.rt.d === TODAY && S.log[TODAY] && !S.log[TODAY].done) startRun(S.log[TODAY].day);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
