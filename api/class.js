// 수업 모드 · 우리 반 시간 지도 · 2주 실천 체크 (이름 없이 숫자만 저장, 60일 뒤 자동 삭제)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 24 * 3600;
async function r(...cmd) {
  const res = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await res.json(); if (j.error) throw new Error(j.error); return j.result;
}
const rnd = (n, abc) => Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const clean = (v, max) => String(v == null ? '' : v).slice(0, max);
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0; };
function pairs(arr) { const o = {}; for (let i = 0; i + 1 < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1]; return o; }
function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
  if (!URL_ || !TOKEN) return send(503, { error: '서버 저장소가 아직 연결되지 않았어요.' });
  const q = req.query || {}; let b = req.body || {};
  if (typeof b === 'string') b = parse(b) || {};
  const a = b.a || q.a; const code = clean(b.code || q.code, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
  try {
    if (a === 'create') {
      let c = ''; for (let i = 0; i < 6; i++) { c = rnd(4, CODE_ABC); if (!(await r('EXISTS', 'tp:c:' + c))) break; }
      const key = rnd(16, 'abcdefghijkmnpqrstuvwxyz23456789');
      const meta = { key, title: clean(b.title, 40) || '우리 반', level: b.level === 'high' ? 'high' : 'uni', dept: clean(b.dept, 20), created: Date.now() };
      await r('SET', 'tp:c:' + c, JSON.stringify(meta), 'EX', TTL);
      return send(200, { code: c, key, title: meta.title, level: meta.level });
    }
    const meta = parse(await r('GET', 'tp:c:' + code));
    if (!meta) return send(404, { error: '수업 코드를 찾지 못했어요.' });
    if (a === 'info') return send(200, { title: meta.title, level: meta.level, dept: meta.dept });
    if (a === 'up') {
      const sid = clean(b.sid, 24).replace(/[^a-z0-9]/gi, ''); if (!sid) return send(400, { error: 'sid' });
      const d = b.d || {};
      const row = { phone: num(d.phone, 0, 24), free: num(d.free, 0, 168), weeks: num(d.weeks, 0, 400), goal: !!d.goal, stones: num(d.stones, 0, 40), blocks: num(d.blocks, 0, 30), cal: !!d.cal, routine: !!d.routine, path: clean(d.path, 12), t: Date.now() };
      await r('HSET', 'tp:s:' + code, sid, JSON.stringify(row)); await r('EXPIRE', 'tp:s:' + code, TTL);
      return send(200, { ok: true });
    }
    if (a === 'check') {
      const sid = clean(b.sid, 24).replace(/[^a-z0-9]/gi, '') || rnd(10, 'abcdefghijk23456789');
      const row = { kept: num(b.kept, 0, 3), review: !!b.review, keep: num(b.keep, 1, 5), t: Date.now() };
      await r('HSET', 'tp:k:' + code, sid, JSON.stringify(row)); await r('EXPIRE', 'tp:k:' + code, TTL);
      return send(200, { ok: true });
    }
    if (a === 'dash') {
      if (clean(q.key || b.key, 32) !== meta.key) return send(403, { error: '강사용 키가 맞지 않아요.' });
      const S = Object.values(pairs(await r('HGETALL', 'tp:s:' + code))).map(parse).filter(Boolean);
      const K = Object.values(pairs(await r('HGETALL', 'tp:k:' + code))).map(parse).filter(Boolean);
      const n = S.length, avg = f => n ? S.reduce((s, x) => s + f(x), 0) / n : 0;
      const hist = [0, 0, 0, 0, 0]; S.forEach(x => { hist[x.phone < 2 ? 0 : x.phone < 4 ? 1 : x.phone < 6 ? 2 : x.phone < 8 ? 3 : 4]++; });
      const paths = {}; S.forEach(x => { if (x.path) paths[x.path] = (paths[x.path] || 0) + 1; });
      const kn = K.length;
      return send(200, {
        title: meta.title, level: meta.level, code, n,
        steps: { jin: n, jang: S.filter(x => x.goal || x.stones > 0).length, dan: S.filter(x => x.blocks > 0 && x.cal).length, jeom: S.filter(x => x.routine).length },
        phone: avg(x => x.phone), free: avg(x => x.free), weeks: avg(x => x.weeks),
        freeTotal: S.reduce((s, x) => s + x.free * x.weeks, 0), gain: S.reduce((s, x) => s + 7 * x.weeks, 0),
        hist, paths, blocks: S.reduce((s, x) => s + x.blocks, 0),
        check: { n: kn, kept1: K.filter(x => x.kept >= 1).length, review: K.filter(x => x.review).length, keep: kn ? K.reduce((s, x) => s + x.keep, 0) / kn : 0, dist: [0, 1, 2, 3].map(v => K.filter(x => x.kept === v).length) }
      });
    }
    return send(400, { error: '알 수 없는 요청이에요.' });
  } catch (e) { return send(500, { error: '잠시 후 다시 시도해 주세요.' }); }
};
