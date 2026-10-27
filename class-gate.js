/* 강의 시간에만 열리는 화면 (2026-10-27 대표님 결정)
   대학생용(/)·고등학생용(/high)의 <head>에서 가장 먼저 불러옵니다. 2주 실천 체크(/check)·수업 모드(/teach)는 잠그지 않음
   · 허브에서 강의 입장 코드로 들어온 학생: 허브 앱 목록의 버튼 주소에 ?cu=코드 끝나는 시각(ms)이 붙어 옴
     → 이 기기의 localStorage moa_class_until에 기억하고 그 시각까지 열림 (주소에서는 바로 지움)
   · 강사: 이 기기에서 수업 모드(/teach)로 수업을 만든 기록(moa-tp-teach)이 있으면 언제든 열림
   · 그 밖에는 화면을 가리고 허브 입장 안내만 보여 줌. 입력해 둔 설계도(moa-tp-uni-v1 등)는 지우지 않음
   ※ AI 비용이 없는 화면이라 학생 기기에서만 확인함 (허브 class-gate.js와 같은 방식) */
(function () {
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  try {
    var q = new URLSearchParams(location.search), cu = +q.get('cu') || 0;
    if (q.has('cu')) {
      if (cu > Date.now()) localStorage.setItem('moa_class_until', String(cu));
      q.delete('cu');
      history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
  } catch (e) {}
  var until = +ls('moa_class_until') || 0, teach = [];
  try { teach = JSON.parse(ls('moa-tp-teach') || '[]'); } catch (e) {}
  if (Date.now() < until || (Array.isArray(teach) && teach.length)) return;
  var css = document.createElement('style');
  css.textContent = 'body>*:not(#moa-gate){display:none !important}' +
    '#moa-gate{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;box-sizing:border-box;background:#D6E8FD;font-family:"Noto Sans KR",sans-serif;color:#0F1E3D}' +
    '#moa-gate .g{max-width:420px;width:100%;border-radius:20px;padding:26px 22px;background:#fff;text-align:center}' +
    '#moa-gate .o{font-size:12.5px;font-weight:700;letter-spacing:.06em}' +
    '#moa-gate .t{display:inline-block;margin:10px 0 6px;padding:2px 10px;background:#FF3D6E;color:#fff;font-weight:900;font-size:22px}' +
    '#moa-gate h1{font-size:19px;margin:6px 0 8px;word-break:keep-all;text-wrap:balance}' +
    '#moa-gate p{font-size:14px;line-height:1.6;margin:0 0 18px;word-break:keep-all}' +
    '#moa-gate a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 22px;border-radius:12px;background:#0F1E3D;color:#fff;font-weight:700;text-decoration:none}';
  document.head.appendChild(css);
  function show() {
    if (document.getElementById('moa-gate')) return;
    var d = document.createElement('div');
    d.id = 'moa-gate';
    d.innerHTML = '<div class="g"><div class="o">MOA FORMULA</div><div class="t">시간 설계도</div><h1>강의 시간에만 이용할 수 있습니다</h1>' +
      '<p>허브에서 강의 입장 코드로 들어온 뒤 앱 목록의 나의 시간 설계도 카드에서 열어 주세요. 입력해 둔 설계도는 그대로 남아 있습니다.</p>' +
      '<a href="https://moa-hub.vercel.app/">허브로 가기</a></div>';
    document.body.appendChild(d);
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
