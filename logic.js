'use strict';
/* Чистая логика без DOM — проверяется в test.js (node test.js) */

// Неделя программы от даты старта: 1..3, дальше 4+ (продолжение)
function weekOf(start, today) {
  var d = Math.floor((Date.parse(today) - Date.parse(start)) / 864e5);
  return d < 0 ? 1 : Math.floor(d / 7) + 1;
}

// Калории и БЖУ: Миффлин–Сан Жеор (муж.), активность 1.55 (3 силовые + 8–10к шагов),
// дефицит 500 ккал — потолок по Murphy & Koehler 2022, больше — режет мышцы
function macros(p) {
  var bmr = 10 * p.w + 6.25 * p.h - 5 * p.age + 5;
  var tdee = Math.round(bmr * 1.55);
  var kcal = Math.max(tdee - 500, Math.round(bmr)); // ниже BMR не опускаемся
  var prot = Math.round(p.w * 1.8), fat = Math.round(p.w * 0.8);
  var carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: tdee, kcal: kcal, prot: prot, fat: fat, carb: carb };
}

// Двойная прогрессия: все подходы на верх диапазона — добавь вес; ниже низа — сбавь
function hint(last, lo, hi, inc) {
  if (!last || !last.length) return { t: 'new', msg: 'Первый раз: подбери вес, чтобы оставалось ' };
  var kg = Math.max.apply(null, last.map(function (s) { return +s[0] || 0; }));
  var reps = last.map(function (s) { return +s[1] || 0; });
  if (reps.every(function (r) { return r >= hi; })) return { t: 'up', kg: kg + inc, msg: 'Все подходы на ' + hi + ' — бери ' + (kg + inc) + ' кг' };
  if (reps.some(function (r) { return r < lo; })) return { t: 'down', kg: kg, msg: 'Не добрал ' + lo + ' — оставь ' + kg + ' кг, добей повторы' };
  return { t: 'same', kg: kg, msg: kg + ' кг — добавь +1 повтор в каждом подходе' };
}

// Скользящее среднее веса за 7 последних записей — суточные скачки воды не врут
function avg7(list) {
  var v = list.slice(-7);
  return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 10) / 10 : null;
}

var NEXT = { A: 'B', B: 'C', C: 'A' };
function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function wday(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); } // 0 = вс

// План на даты: сделанные — из журнала, будущие тренировочные — по кругу A→B→C, прошедшие без записи — пропуск
// log: { 'YYYY-MM-DD': { day:'A', done:true } }, train: дни недели [1,3,5]
function schedule(dates, today, log, train) {
  var done = Object.keys(log).filter(function (d) { return log[d].done; }).sort();
  var before = done.filter(function (d) { return d < dates[0]; });
  var last = before.length ? log[before[before.length - 1]].day : null, out = {};
  dates.forEach(function (d) {
    var L = log[d];
    if (L && L.done) { out[d] = { day: L.day, st: 'done' }; last = L.day; }
    else if (train.indexOf(wday(d)) >= 0) {
      if (d < today) out[d] = { st: 'miss' };
      else { last = last ? NEXT[last] : 'A'; out[d] = { day: last, st: d === today ? 'today' : 'plan' }; }
    } else out[d] = { st: 'rest' };
  });
  return out;
}

// Оценка недели 0–100: половина — тренировки по плану, половина — привычки (4 в день)
// Сегодня считается, только если уже что-то сделано — незаконченный день не штрафуем. null — оценивать пока нечего
function score(dates, today, log, hab, train) {
  function marks(d) { var x = hab[d] || {}; return ['p', 'k', 's', 'z'].filter(function (k) { return x[k]; }).length; }
  var tr = dates.filter(function (d) { return train.indexOf(wday(d)) >= 0 && (d < today || d === today && log[d] && log[d].done); });
  var hd = dates.filter(function (d) { return d < today || d === today && marks(d); });
  var extra = dates.filter(function (d) { return log[d] && log[d].done && tr.indexOf(d) < 0 && d <= today; }).length; // тренировка в день отдыха
  if (!tr.length && !hd.length && !extra) return null;
  var done = tr.filter(function (d) { return log[d] && log[d].done; }).length + extra;
  var h = hd.reduce(function (s, d) { return s + marks(d); }, 0);
  var t = tr.length ? Math.min(1, done / tr.length) : (done ? 1 : null), hp = hd.length ? h / (4 * hd.length) : null;
  if (t === null) return Math.round(100 * hp);
  if (hp === null) return Math.round(100 * t);
  return Math.round(50 * t + 50 * hp);
}

// Сон. n: [{ dur, bed, wake }] — длительность (мин), отход и подъём (минуты от полуночи)
// Регулярность — стандартное отклонение времени отхода/подъёма; отход считаем от полудня, чтобы 23:50 и 00:10 были рядом
function sleepStats(n) {
  if (!n.length) return null;
  function sd(a) {
    var m = a.reduce(function (s, x) { return s + x; }, 0) / a.length;
    return Math.round(Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / a.length));
  }
  return {
    avg: Math.round(n.reduce(function (s, x) { return s + x.dur; }, 0) / n.length),
    bedSd: n.length > 1 ? sd(n.map(function (x) { return (x.bed + 720) % 1440; })) : null,
    wakeSd: n.length > 1 ? sd(n.map(function (x) { return x.wake; })) : null,
    debt: n.reduce(function (s, x) { return s + Math.max(0, 480 - x.dur); }, 0) // недосып до 8 часов, мин
  };
}

// Утренняя оценка 1–5 против длительности и времени отхода. n: [{ dur, bed, q }]; без q — не учитываем
// Сравнения показываем, только когда в каждой группе хотя бы 2 ночи: по одной ночи выводы — шум
function sleepInsight(n) {
  var r = n.filter(function (x) { return x.q; });
  if (r.length < 4) return { need: 4 - r.length };
  function avg(a) { return Math.round(a.reduce(function (s, x) { return s + x.q; }, 0) / a.length * 10) / 10; }
  var out = { n: r.length, avg: avg(r) };
  var hi = r.filter(function (x) { return x.dur >= 420; }), lo = r.filter(function (x) { return x.dur < 420; });
  if (hi.length >= 2 && lo.length >= 2) out.dur = { hi: avg(hi), lo: avg(lo) };
  var bk = {};
  r.forEach(function (x) { var h = Math.floor(x.dur / 60); (bk[h] = bk[h] || []).push(x); });
  Object.keys(bk).forEach(function (h) { if (bk[h].length >= 2 && (!out.best || avg(bk[h]) > out.best.q)) out.best = { h: +h, q: avg(bk[h]) }; });
  var early = r.filter(function (x) { return (x.bed + 720) % 1440 < 720; }), late = r.filter(function (x) { return (x.bed + 720) % 1440 >= 720; }); // до/после полуночи
  if (early.length >= 2 && late.length >= 2) out.bed = { early: avg(early), late: avg(late) };
  return out;
}

// Календарь (.ics) для iPhone/Google: события в местном времени + напоминание за remind минут
// ev: [{ date:'2026-11-11', time:'18:00', min:65, title:'…', desc:'…' }]
function icsCal(ev, remind, stamp) {
  function t(d, hm, add) {
    var p = hm.split(':'), m = +p[0] * 60 + +p[1] + (add || 0), dd = d;
    while (m >= 1440) { m -= 1440; dd = addDays(dd, 1); }
    return dd.replace(/-/g, '') + 'T' + ('0' + Math.floor(m / 60)).slice(-2) + ('0' + m % 60).slice(-2) + '00';
  }
  function esc(s) { return String(s).replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); }
  var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//zal21//RU', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Зал · 21 день'];
  ev.forEach(function (e) {
    out.push('BEGIN:VEVENT', 'UID:' + e.date + '@zal21', 'DTSTAMP:' + stamp, 'DTSTART:' + t(e.date, e.time), 'DTEND:' + t(e.date, e.time, e.min),
      'SUMMARY:' + esc(e.title), 'DESCRIPTION:' + esc(e.desc),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.title), 'TRIGGER:-PT' + remind + 'M', 'END:VALARM', 'END:VEVENT');
  });
  out.push('END:VCALENDAR');
  return out.join('\r\n') + '\r\n';
}

if (typeof module !== 'undefined') module.exports = { weekOf: weekOf, macros: macros, hint: hint, avg7: avg7, schedule: schedule, score: score, addDays: addDays, wday: wday, icsCal: icsCal, sleepStats: sleepStats, sleepInsight: sleepInsight };
