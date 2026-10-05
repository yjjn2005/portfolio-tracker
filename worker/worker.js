// 포트폴리오 시세 서버 — 야후 파이낸스 차트 API 프록시 (키 불필요), 60초 캐시
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-PIN, X-NEW-PIN',
};
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-quote/1.0)' };

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });

async function quoteOne(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
  const r = await fetch(url, { headers: UA, cf: { cacheTtl: 60, cacheEverything: true } });
  if (!r.ok) return null;
  const j = await r.json();
  const m = j?.chart?.result?.[0]?.meta;
  if (!m || m.regularMarketPrice == null) return null;
  return {
    price: m.regularMarketPrice,
    prev: m.chartPreviousClose ?? m.previousClose ?? null,
    currency: m.currency,
    name: m.longName || m.shortName || sym,
    time: m.regularMarketTime || null,
  };
}

// 국내 종목(네이버 증권 실시간 API) — 심볼 형식 'KR:005930'. 응답은 EUC-KR이라 바이트를 그대로 문자열로 만들어 파싱(이름은 쓰지 않음)
async function quoteKR(codes) {
  const out = {};
  for (let i = 0; i < codes.length; i += 12) {
    const part = codes.slice(i, i + 12);
    try {
      const r = await fetch('https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:' + part.join(','), { headers: UA, cf: { cacheTtl: 15, cacheEverything: true } });
      if (!r.ok) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      let s = ''; for (let k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k]);
      const j = JSON.parse(s);
      for (const x of (j?.result?.areas?.[0]?.datas || [])) {
        out['KR:' + x.cd] = { price: x.nv, prev: x.pcv, currency: 'KRW', name: x.cd, state: x.ms, time: Math.floor(Date.now() / 1000) };
      }
    } catch (e) {}
  }
  return out;
}

// 배당 내역(야후 파이낸스): 최근 약 13개월, 종목통화 기준 1주당 금액
async function dividendsOne(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2y&interval=1mo&events=div`;
  const r = await fetch(url, { headers: UA, cf: { cacheTtl: 21600, cacheEverything: true } });
  if (!r.ok) return null;
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) return null;
  const cut = Date.now() / 1000 - 400 * 86400;
  const items = Object.values(res.events?.dividends || {}).filter(x => x.date >= cut).sort((a, b) => a.date - b.date).map(x => ({ t: x.date, a: x.amount }));
  return { currency: res.meta?.currency || '', items };
}

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pf-salt:' + s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// 가족별 데이터 분리: ?p=hy|th|he|jw (기본·유재진은 기존 키 유지)
const personSuffix = u => { const p = u.searchParams.get('p') || ''; return /^(hy|th|he|jw)$/.test(p) ? ':' + p : ''; };

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const u = new URL(req.url);

    if (u.pathname === '/quote') {
      const syms = (u.searchParams.get('symbols') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 90);
      if (!syms.length) return json({ error: 'symbols required' }, 400);
      const out = {};
      const kr = syms.filter(s => s.startsWith('KR:')).map(s => s.slice(3));
      const rest = syms.filter(s => !s.startsWith('KR:'));
      await Promise.all([
        quoteKR(kr).then(o => Object.assign(out, o)),
        ...rest.map(async s => { try { const q = await quoteOne(s); if (q) out[s] = q; } catch (e) {} }),
      ]);
      return json({ quotes: out, at: Date.now() }, 200, { 'Cache-Control': 'public, max-age=30' });
    }

    // 종목명 → 심볼 후보 (종목 코드 확인용)
    if (u.pathname === '/search') {
      const q = u.searchParams.get('q') || '';
      if (!q) return json({ error: 'q required' }, 400);
      const r = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&lang=ko-KR&region=KR`, { headers: UA });
      const j = r.ok ? await r.json() : { quotes: [] };
      const list = (j.quotes || []).map(x => ({ symbol: x.symbol, name: x.longname || x.shortname, exch: x.exchDisp, type: x.quoteType }));
      return json({ results: list });
    }

    if (u.pathname === '/div') {
      const syms = (u.searchParams.get('symbols') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 60);
      if (!syms.length) return json({ error: 'symbols required' }, 400);
      const out = {};
      await Promise.all(syms.map(async s => { try { const q = await dividendsOne(s); if (q) out[s] = q; } catch (e) {} }));
      return json({ divs: out, at: Date.now() }, 200, { 'Cache-Control': 'public, max-age=3600' });
    }

    // 목표비중·거래일지·자산추이: PIN 보호 저장소 /kv/targets|journal|hist
    const kv = u.pathname.match(/^\/kv\/(targets|journal|hist)$/);
    if (kv) {
      const stored = await env.PF.get('pin');
      const pin = req.headers.get('X-PIN') || '';
      if (!stored) return json({ error: 'not initialized' }, 404);
      if ((await sha(pin)) !== stored) return json({ error: 'bad pin' }, 401);
      const key = 'kv:' + kv[1] + personSuffix(u);
      if (req.method === 'PUT') {
        const body = await req.text();
        if (body.length > 500000) return json({ error: 'too large' }, 413);
        try { JSON.parse(body); } catch (e) { return json({ error: 'bad json' }, 400); }
        await env.PF.put(key, body);
        return json({ ok: true });
      }
      const v = await env.PF.get(key);
      return new Response(v || 'null', { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
    }

    // 보유 데이터(PIN 필요): GET 조회 / PUT 저장(저장 시 X-NEW-PIN 으로 PIN 변경)
    if (u.pathname === '/data') {
      const stored = await env.PF.get('pin');
      const pin = req.headers.get('X-PIN') || '';
      if (req.method === 'PUT') {
        if (stored && (await sha(pin)) !== stored) return json({ error: 'bad pin' }, 401);
        if (!stored && !pin) return json({ error: 'pin required' }, 400);
        const body = await req.text();
        if (body.length > 900000) return json({ error: 'too large' }, 413);
        await env.PF.put('data' + personSuffix(u), body);
        const np = req.headers.get('X-NEW-PIN');
        if (!stored || np) await env.PF.put('pin', await sha(np || pin));
        return json({ ok: true });
      }
      if (!stored) return json({ error: 'not initialized' }, 404);
      if ((await sha(pin)) !== stored) return json({ error: 'bad pin' }, 401);
      const d = await env.PF.get('data' + personSuffix(u));
      return new Response(d || '{"rows":[],"syms":{}}', { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
    }

    return json({ ok: true, usage: ['/quote?symbols=005930.KS,AAPL,USDKRW=X', '/search?q=삼성전자'] });
  },
};
