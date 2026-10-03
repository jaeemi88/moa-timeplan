module.exports = (req, res) => {
  const d = String((req.query && req.query.d) || '');
  let txt = '';
  try { txt = Buffer.from(d, 'base64url').toString('utf8'); } catch (e) { txt = ''; }
  if (!txt.startsWith('BEGIN:VCALENDAR') || txt.length > 30000) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('캘린더 정보를 읽지 못했어요. 앱으로 돌아가 다시 눌러 주세요.');
    return;
  }
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="moa-timeplan.ics"');
  res.setHeader('Cache-Control', 'no-store');
  res.end(txt);
};
