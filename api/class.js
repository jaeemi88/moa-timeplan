// 수업 모드 · 우리 반 시간 지도 · 2주 실천 체크 (이름 없이 숫자만 저장, 60일 뒤 자동 삭제)
const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL;
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 24 * 3600;
// 외부 패키지 없이 Redis 서버에 바로 연결 (RESP 프로토콜, 요청마다 연결 1개)
const net = require('net'), tls = require('tls');
function enc(cmd) { let o = '*' + cmd.length + '\r\n'; for (const c of cmd) { const b = Buffer.from(String(c)); o += '$' + b.length + '\r\n' + b.toString('binary') + '\r\n'; } return Buffer.from(o, 'binary'); }
function parseAt(buf, i) {
  const nl = buf.indexOf('\r\n', i); if (nl < 0) return null;
  const t = String.fromCharCode(buf[i]), line = buf.toString('utf8', i + 1, nl), next = nl + 2;
  if (t === '+') return [line, next];
  if (t === '-') return [new Error(line), next];
  if (t === ':') return [Number(line), next];
  if (t === '$') { const n = Number(line); if (n < 0) return [null, next]; if (buf.length < next + n + 2) return null; return [buf.toString('utf8', next, next + n), next + n + 2]; }
  if (t === '*') { const n = Number(line); if (n < 0) return [null, next]; const arr = []; let j = next; for (let k = 0; k < n; k++) { const r = parseAt(buf, j); if (!r) return null; arr.push(r[0]); j = r[1]; } return [arr, j]; }
  throw new Error('RESP');
}
function redisRun(cmds) {
  return new Promise((resolve, reject) => {
    const u = new URL(REDIS_URL); const port = Number(u.port || 6379);
    const all = [];
    if (u.password) all.push(u.username ? ['AUTH', decodeURIComponent(u.username), decodeURIComponent(u.password)] : ['AUTH', decodeURIComponent(u.password)]);
    const skip = all.length; all.push(...cmds);
    const opt = { host: u.hostname, port };
    const sock = u.protocol === 'rediss:' ? tls.connect({ ...opt, servername: u.hostname }) : net.connect(opt);
    let buf = Buffer.alloc(0); const out = [];
    const done = (e, v) => { clearTimeout(tm); sock.destroy(); e ? reject(e) : resolve(v); };
    const tm = setTimeout(() => done(new Error('timeout')), 6000);
    sock.on('error', e => done(e));
    sock.on(u.protocol === 'rediss:' ? 'secureConnect' : 'connect', () => sock.write(Buffer.concat(all.map(enc))));
    sock.on('data', d => { buf = Buffer.concat([buf, d]); let i = 0; let r;
      while (out.length < all.length && i < buf.length && (r = parseAt(buf, i))) { out.push(r[0]); i = r[1]; }
      buf = buf.slice(i);
      if (out.length === all.length) { const res = out.slice(skip); const err = out.find(x => x instanceof Error); err ? done(err) : done(null, res); } });
  });
}
async function r(...cmd) {
  if (REDIS_URL) return (await redisRun([cmd]))[0];
  const res = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await res.json(); if (j.error) throw new Error(j.error); return j.result;
}
const rnd = (n, abc) => Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const clean = (v, max) => String(v == null ? '' : v).slice(0, max);
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0; };
function pairs(arr) { if (arr && !Array.isArray(arr)) return arr; const o = {}; for (let i = 0; i + 1 < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1]; return o; }
function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
  if (!REDIS_URL && (!URL_ || !TOKEN)) return send(503, { error: '서버 저장소가 아직 연결되지 않았어요.' });
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
