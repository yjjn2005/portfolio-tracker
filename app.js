(function(){
  var H=[],CFG=window.APP_CONFIG||{};
  var FXR={KRW:1,USD:1359.6,JPY:8.6032,CNY:202.55};
  var live={};
  var TYPES=['위탁','개인연금','퇴직연금','IRP'];
  var BROKERS=['한국투자증권','삼성증권','미래에셋증권','신한증권','유안타증권'];
  var OWNERS=['개인','법인'];
  var sel={o:null,b:null,t:null,m:null};
  var LAB={o:'구분',b:'증권사',t:'계좌성격',m:'자산'};
  var MKTS=['국내','해외','현금'];
  function won(n){return Math.round(n).toLocaleString('ko-KR')}
  function sgn(n){return (n>0?'+':n<0?'−':'')+won(Math.abs(n))}
  function pct(n){return (n>0?'+':n<0?'−':'')+Math.abs(n).toFixed(2)+'%'}
  function cls(n){return n>0?'up':n<0?'down':''}
  function pass(h,skip){return (skip==='o'||!sel.o||h.o===sel.o)&&(skip==='b'||!sel.b||h.b===sel.b)&&(skip==='t'||!sel.t||h.t===sel.t)&&(skip==='m'||!sel.m||h.m===sel.m)}
  function sum(rows){
    var r={ev:0,inv:0,invEv:0,fee:0,cash:0,n:0};
    rows.forEach(function(h){if(h.halt)return;r.ev+=h.ev;if(h.cash){r.cash+=h.ev}else{r.inv+=h.buy;r.invEv+=h.ev;r.fee+=h.fee;r.n++}});
    r.pl=r.invEv-r.inv-r.fee;r.r=r.inv?r.pl/r.inv*100:0;return r;
  }
  function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
  function dim(id,key,list){
    var rows=H.filter(function(h){return pass(h,key)});
    var tot=sum(rows).ev,html='<h3>'+LAB[key]+'별</h3>';
    list.forEach(function(v){
      var has=H.some(function(h){return h[key]===v});
      var sub=rows.filter(function(h){return h[key]===v});
      var g=sum(sub),w=tot?g.ev/tot*100:0;
      var names=[];H.forEach(function(h){if(h[key]===v&&key==='o'&&names.indexOf(h.on)<0)names.push(h.on)});
      var small=key==='o'&&names.length?'<small>'+esc(names.join(' · '))+'</small>':'';
      if(!has){html+='<div class="dr empty"><span class="n">'+v+'<small>사진 대기</small></span><span class="b"></span><span class="a num">-</span><span class="p num">-</span></div>';return}
      html+='<button type="button" class="dr" data-k="'+key+'" data-v="'+v+'" aria-pressed="'+(sel[key]===v)+'">'+
        '<span class="n">'+v+small+'</span><span class="b"><i style="width:'+w.toFixed(1)+'%"></i></span>'+
        '<span class="a num">'+(g.ev?won(g.ev):'-')+'</span>'+
        '<span class="p num"><span class="sh">'+w.toFixed(1)+'%</span><span class="'+cls(g.pl)+'">'+(g.inv?sgn(g.pl)+' ('+pct(g.r)+')':'-')+'</span></span></button>';
    });
    document.getElementById(id).innerHTML=html;
  }
  function matrix(){
    var rows=H.filter(function(h){return pass(h,'b')&&pass(h,'t')});
    var h='<table class="mtx"><tr><th>증권사</th>'+TYPES.map(function(t){return '<th class="num">'+t+'</th>'}).join('')+'<th class="num">합계</th></tr>';
    var colTot={};
    BROKERS.forEach(function(b){
      var br=rows.filter(function(x){return x.b===b});
      var line='<tr><td>'+b+'</td>',tt=0;
      TYPES.forEach(function(t){var v=sum(br.filter(function(x){return x.t===t})).ev;tt+=v;colTot[t]=(colTot[t]||0)+v;line+='<td class="num'+(v?'':' z')+'">'+(v?won(v):'-')+'</td>'});
      colTot.all=(colTot.all||0)+tt;
      h+=line+'<td class="num" style="font-weight:700">'+(tt?won(tt):'-')+'</td></tr>';
    });
    h+='<tr><td style="font-weight:700">합계</td>'+TYPES.map(function(t){return '<td class="num" style="font-weight:700">'+(colTot[t]?won(colTot[t]):'-')+'</td>'}).join('')+'<td class="num" style="font-weight:700">'+won(colTot.all||0)+'</td></tr></table>';
    document.getElementById('matrix').innerHTML=h;
  }
  function movers(rows){
    var list=rows.filter(function(h){return !h.cash&&!h.halt}).map(function(h){var pl=h.ev-h.buy-h.fee;return{h:h,pl:pl,r:h.buy?pl/h.buy*100:0}});
    function box(arr,title){
      return '<h3>'+title+'</h3>'+(arr.length?arr.map(function(x){return '<div class="mv"><span>'+esc(x.h.n)+'<small>'+x.h.b+' · '+x.h.t+(x.h.o==='법인'?' · '+esc(x.h.on):'')+'</small></span><span class="num '+cls(x.pl)+'">'+sgn(x.pl)+'<small class="num '+cls(x.pl)+'">'+pct(x.r)+'</small></span></div>'}).join(''):'<div class="legend">해당 종목이 없습니다.</div>');
    }
    var g=list.filter(function(x){return x.pl>0}).sort(function(a,b){return b.pl-a.pl}).slice(0,5);
    var l=list.filter(function(x){return x.pl<0}).sort(function(a,b){return a.pl-b.pl}).slice(0,5);
    document.getElementById('gain').innerHTML=box(g,'수익 큰 종목 5');
    document.getElementById('loss').innerHTML=box(l,'손실 큰 종목 5');
  }
  var sortK='ev',sortD=-1,query='';
  function stocks(rows){
    var map={},order=[];
    rows.forEach(function(h){if(h.cash)return;var k=h.n;if(!map[k]){map[k]={n:h.n,m:h.m,q:0,buy:0,ev:0,fee:0,at:{},acc:[]};order.push(k)}
      var s=map[k];s.q+=h.q;s.buy+=h.buy;s.ev+=h.ev;s.fee+=h.fee;s.at[h.a]=1;s.acc.push(h.b.replace('증권','')+' '+h.t+(h.o==='법인'?'(법인)':'')+' '+won(h.q)+'주')});
    var list=order.map(function(k){var s=map[k];s.pl=s.ev-s.buy-s.fee;s.r=s.buy?s.pl/s.buy*100:0;return s});list.forEach(function(s){s.w=s.ev});
    var tot=list.reduce(function(x,s){return x+s.ev},0);
    if(query){var qq=query.toLowerCase();list=list.filter(function(s){return s.n.toLowerCase().indexOf(qq)>=0})}
    list.sort(function(x,y){var a=x[sortK],b=y[sortK];if(typeof a==='string')return sortD*a.localeCompare(b,'ko');return sortD*(a-b)});
    function th(k,t,num){return '<th class="s'+(num?' num':'')+'" data-sort="'+k+'"'+(sortK===k?' aria-sort="'+(sortD<0?'descending':'ascending')+'"':'')+'>'+t+'</th>'}
    var h='<table><tr>'+th('n','종목')+th('ev','평가금액',1)+th('w','비중',1)+th('pl','순손익',1)+th('r','수익률',1)+th('buy','매입금액',1)+th('q','수량',1)+'</tr>';
    list.forEach(function(s){h+='<tr><td>'+esc(s.n)+'<div class="hold">'+esc(s.acc.join(' · '))+'</div></td><td class="num">'+won(s.ev)+'</td><td class="num">'+(tot?(s.ev/tot*100).toFixed(1)+'%':'-')+'</td><td class="num '+cls(s.pl)+'">'+sgn(s.pl)+'</td><td class="num '+cls(s.r)+'">'+pct(s.r)+'</td><td class="num">'+won(s.buy)+'</td><td class="num">'+won(s.q)+'</td></tr>'});
    h+='</table>';
    document.getElementById('stocks').innerHTML=list.length?h:'<div class="legend">해당 종목이 없습니다.</div>';
  }
  function render(){
    var rows=H.filter(function(h){return pass(h)});
    var T=sum(rows),cnt={};rows.forEach(function(h){cnt[h.a]=1});
    document.getElementById('tiles').innerHTML=
      '<div class="tile main"><div class="l">총 평가금액</div><div class="v">'+won(T.ev)+'</div><div class="sm">계좌 '+Object.keys(cnt).length+'개 · 종목 '+T.n+'개</div></div>'+
      '<div class="tile"><div class="l">투자 원금</div><div class="v">'+won(T.inv)+'</div><div class="sm">현금 제외 매입금액</div></div>'+
      '<div class="tile"><div class="l">순손익</div><div class="v '+cls(T.pl)+'">'+sgn(T.pl)+'</div><div class="sm">제비용 반영</div></div>'+
      '<div class="tile"><div class="l">수익률</div><div class="v '+cls(T.r)+'">'+pct(T.r)+'</div><div class="sm">현금 제외</div></div>'+
      '<div class="tile"><div class="l">현금성 자산</div><div class="v">'+won(T.cash)+'</div><div class="sm">예수금·외화·RP</div></div>';
    var fb='<span class="lab">보는 조건</span>';
    var any=false;
    ['o','b','t','m'].forEach(function(k){if(sel[k]){any=true;fb+='<button type="button" class="fchip" data-clear="'+k+'">'+LAB[k]+' '+sel[k]+' ✕</button>'}});
    fb+=any?'<button type="button" class="chip" data-clear="all">전체 보기</button>':'<span class="lab">전체 (아래 줄을 눌러 좁혀 보세요)</span>';
    document.getElementById('fbar').innerHTML=fb;
    dim('d-o','o',OWNERS);dim('d-b','b',BROKERS);dim('d-t','t',TYPES);dim('d-m','m',MKTS);
    matrix();movers(rows);
    var groups={},order=[];
    rows.forEach(function(h){if(!groups[h.a]){groups[h.a]=[];order.push(h.a)}groups[h.a].push(h)});
    var openSet={};[].forEach.call(document.querySelectorAll('details.acct[open]'),function(d){openSet[d.getAttribute('data-a')]=1});
    var allOpen=document.getElementById('toggleAll').getAttribute('data-open')==='1';
    var out='';
    order.forEach(function(a){
      var list=groups[a],h0=list[0],g=sum(list);
      out+='<details class="acct" data-a="'+a+'"'+((openSet[a]||allOpen)?' open':'')+'><summary class="acct-h"><div><div class="t">'+h0.b+' · '+h0.t+'</div><div class="s">'+h0.o+' · '+esc(h0.on)+' · '+a+'</div></div>'+
        '<div style="text-align:right"><div class="num" style="font-weight:600">'+won(g.ev)+'</div><div class="num '+cls(g.pl)+'" style="font-size:.82rem">'+(g.inv?sgn(g.pl)+' ('+pct(g.r)+')':'현금만 보유')+'</div></div></summary>'+
        '<div class="scroll"><table><tr><th>종목</th><th class="num">수량</th><th class="num">매입단가</th><th class="num">현재가</th><th class="num">매입금액</th><th class="num">평가금액</th><th class="num">제비용</th><th class="num">순손익</th><th class="num">수익률</th></tr>';
      list.forEach(function(h){
        var pl=h.cash?0:h.ev-h.buy-h.fee,r=h.buy&&!h.cash?pl/h.buy*100:0;
        var sub=h.cash?'현금성 · 매입=평가':((h.k||'코드 확인 예정')+' · '+h.m);
        out+='<tr><td>'+esc(h.n)+'<div class="tick">'+sub+'</div></td><td class="num">'+(h.cash?'-':won(h.q))+'</td><td class="num">'+(h.cash?'-':(h.bp%1?h.bp.toFixed(4):won(h.bp)))+'</td><td class="num">'+(h.cash?'-':(h.p%1?h.p.toFixed(2):won(h.p)))+'</td>'+
          '<td class="num">'+won(h.buy)+'</td><td class="num">'+won(h.ev)+'</td><td class="num">'+(h.cash?'-':won(h.fee))+'</td>'+
          '<td class="num '+cls(pl)+'">'+(h.cash?'-':sgn(pl))+'</td><td class="num '+cls(r)+'">'+(h.cash?'-':pct(r))+'</td></tr>';
      });
      out+='</table></div></details>';
    });
    stocks(rows);
    document.getElementById('accts').innerHTML=out||'<div class="card">선택한 조건에 맞는 계좌가 없습니다. "전체 보기"를 눌러 주세요.</div>';
  }
  document.querySelector('main').addEventListener('click',function(e){
    var t=e.target.closest('[data-k],[data-clear]');if(!t)return;
    if(t.hasAttribute('data-k')){var k=t.getAttribute('data-k'),v=t.getAttribute('data-v');sel[k]=sel[k]===v?null:v}
    else{var c=t.getAttribute('data-clear');if(c==='all'){sel={o:null,b:null,t:null,m:null}}else{sel[c]=null}}
    render();
  });
  document.getElementById('stocks').addEventListener('click',function(e){
    var t=e.target.closest('[data-sort]');if(!t)return;var k=t.getAttribute('data-sort');
    if(sortK===k)sortD=-sortD;else{sortK=k;sortD=k==='n'?1:-1}render();
  });
  document.getElementById('q').addEventListener('input',function(){query=this.value.trim();render()});
  function showTab(n){
    ['dash','acct','stock'].forEach(function(x){var on=x===n;document.getElementById('tb-'+x).setAttribute('aria-selected',on);document.getElementById('pn-'+x).hidden=!on});
    try{localStorage.setItem('pf_tab',n)}catch(e){}
    try{window.scrollTo(0,0)}catch(e){}
  }
  document.querySelector('.tabs').addEventListener('click',function(e){var t=e.target.closest('[data-tab]');if(t)showTab(t.getAttribute('data-tab'))});
  try{var st=localStorage.getItem('pf_tab');if(st==='acct'||st==='stock')showTab(st)}catch(e){}
  document.getElementById('toggleAll').onclick=function(){
    var on=this.getAttribute('data-open')!=='1';
    this.setAttribute('data-open',on?'1':'0');this.textContent=on?'모두 접기':'모두 펼치기';
    [].forEach.call(document.querySelectorAll('details.acct'),function(d){d.open=on});
  };

  /* ---- 실시간 시세: Cloudflare Worker(야후 파이낸스 프록시) ---- */
  var SYMS={};
  function setStatus(t){document.getElementById('status').textContent=t}
  function apply(q){
    ['USD','JPY','CNY'].forEach(function(c){var x=q[c+'KRW=X'];if(x&&x.price)FXR[c]=x.price});
    H.forEach(function(h,i){
      var m=SYMS[h.n];if(!m||h.cash)return;var x=q[m[0]];if(!x||!x.price)return;
      h.p=h.pk==='KRW'?Math.round(x.price*(FXR[m[1]]||1)):x.price;h.ev=Math.round(h.q*x.price*(FXR[m[1]]||1));h.live=true;
    });
    document.getElementById('fx').textContent=FXR.USD.toFixed(2);
    render();
  }
  function refresh(){
    if(!CFG.api){setStatus('시세 서버 미연결 · 증권사 화면 기준');return Promise.resolve()}
    var btn=document.getElementById('refresh');btn.disabled=true;setStatus('시세 불러오는 중…');
    var list=['USDKRW=X','JPYKRW=X','CNYKRW=X'];
    H.forEach(function(h){var m=SYMS[h.n];if(m&&list.indexOf(m[0])<0)list.push(m[0])});
    return fetch(CFG.api.replace(/\/$/,'')+'/quote?symbols='+encodeURIComponent(list.join(',')))
      .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
      .then(function(d){apply(d.quotes||{});var n=new Date();setStatus('시세 갱신 '+n.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' · 종목 '+H.filter(function(h){return h.live}).length+'개')})
      .catch(function(){setStatus('시세 갱신 실패 · 증권사 화면 기준')})
      .then(function(){btn.disabled=false});
  }
  document.getElementById('refresh').onclick=refresh;
  document.getElementById('fx').textContent=FXR.USD.toFixed(2);

  /* ---- PIN으로 보유 데이터 불러오기 (데이터는 Cloudflare KV에만 저장) ---- */
  var gate=document.getElementById('gate'),main=document.querySelector('main'),timer=null;
  function load(pin){
    return fetch(CFG.api.replace(/\/$/,'')+'/data',{headers:{'X-PIN':pin},cache:'no-store'}).then(function(r){
      if(r.status===401)throw new Error('bad');if(!r.ok)throw new Error('err');return r.json()}).then(function(d){
      H.length=0;(d.rows||[]).forEach(function(h){H.push(h)});SYMS=d.syms||{};
      try{localStorage.setItem('pf_pin',pin)}catch(e){}
      gate.hidden=true;main.hidden=false;render();
      if(d.asof)setStatus('증권사 화면 기준 '+d.asof);
      refresh();if(!timer)timer=setInterval(function(){if(!document.hidden)refresh()},60000);
    });
  }
  function ask(msg){gate.hidden=false;main.hidden=true;document.getElementById('gmsg').textContent=msg||'';try{document.getElementById('pin').focus()}catch(e){}}
  document.getElementById('gform').onsubmit=function(e){
    e.preventDefault();var p=document.getElementById('pin').value.trim();if(!p)return;
    document.getElementById('gmsg').textContent='확인 중…';
    load(p).catch(function(er){try{localStorage.removeItem('pf_pin')}catch(x){}ask(er.message==='bad'?'PIN이 맞지 않습니다.':'서버에 연결하지 못했습니다.')});
  };
  document.getElementById('lock').onclick=function(){try{localStorage.removeItem('pf_pin')}catch(e){}location.reload()};
  var saved='';try{saved=localStorage.getItem('pf_pin')||''}catch(e){}
  if(saved){load(saved).catch(function(){ask('')})}else{ask('')}
})();
