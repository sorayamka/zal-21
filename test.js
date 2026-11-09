// node test.js — самопроверка логики
var L = require('./logic.js'), a = require('assert');
a.strictEqual(L.weekOf('2026-11-09', '2026-11-09'), 1);
a.strictEqual(L.weekOf('2026-11-09', '2026-11-15'), 1);
a.strictEqual(L.weekOf('2026-11-09', '2026-11-16'), 2);
a.strictEqual(L.weekOf('2026-11-09', '2026-11-30'), 4);
var m = L.macros({ w: 104, h: 180, age: 30 });
a.strictEqual(m.bmr, 2020); a.strictEqual(m.tdee, 3131); a.strictEqual(m.kcal, 2631);
a.strictEqual(m.prot, 187); a.strictEqual(m.fat, 83);
a.ok(Math.abs(m.prot * 4 + m.fat * 9 + m.carb * 4 - m.kcal) < 4);
a.strictEqual(L.hint([[50, 12], [50, 12], [50, 12]], 8, 12, 5).t, 'up');
a.strictEqual(L.hint([[50, 12], [50, 12], [50, 12]], 8, 12, 5).kg, 55);
a.strictEqual(L.hint([[50, 10], [50, 9], [50, 7]], 8, 12, 5).t, 'down');
a.strictEqual(L.hint([[50, 10], [50, 9], [50, 8]], 8, 12, 5).t, 'same');
a.strictEqual(L.hint(null, 8, 12, 5).t, 'new');
a.strictEqual(L.avg7([100, 101, 102]), 101);
a.strictEqual(L.avg7([]), null);
a.strictEqual(L.wday('2026-11-09'), 1); // понедельник
a.strictEqual(L.addDays('2026-11-30', 1), '2026-12-01');
var wk = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
var sc = L.schedule(wk, '2026-11-11', { '2026-11-06': { day: 'C', done: true } }, [1, 3, 5]);
a.strictEqual(sc['2026-11-09'].st, 'miss');           // пн пропущен
a.deepStrictEqual(sc['2026-11-11'], { day: 'A', st: 'today' }); // после C идёт A
a.deepStrictEqual(sc['2026-11-13'], { day: 'B', st: 'plan' });
a.strictEqual(sc['2026-11-10'].st, 'rest');
var sc2 = L.schedule(wk, '2026-11-11', { '2026-11-09': { day: 'A', done: true } }, [1, 3, 5]);
a.strictEqual(sc2['2026-11-11'].day, 'B');
a.strictEqual(L.score(wk, '2026-11-09', { '2026-11-09': { done: true } }, { '2026-11-09': { p: 1, k: 1, s: 1, z: 1 } }, [1, 3, 5]), 100);
a.strictEqual(L.score(wk, '2026-11-10', {}, {}, [1, 3, 5]), 0);            // пн пропущен, привычек нет
a.strictEqual(L.score(wk, '2026-11-09', {}, {}, [1, 3, 5]), null);         // первый день, ещё ничего — не 0
a.strictEqual(L.score(wk, '2026-11-09', {}, { '2026-11-09': { p: 1, s: 1 } }, [1, 3, 5]), 50); // только привычки
a.strictEqual(L.score(wk, '2026-11-10', { '2026-11-09': { done: true } }, {}, [1, 3, 5]), 50);
console.log('ok');
