const test=require('node:test'),assert=require('node:assert/strict'),C=require('../pf-calc.js');
test('group sums by basis and names cash separately for stock basis',()=>{
 const rows=[{n:'A',m:'국내',ev:100},{n:'B',m:'해외',ev:50},{n:'원화',m:'현금',cash:true,ev:30},{n:'A',m:'국내',ev:20}];
 assert.deepEqual(C.group(rows,'m'),[{name:'국내',ev:120},{name:'해외',ev:50},{name:'현금',ev:30}]);
 assert.deepEqual(C.group(rows,'stock').map(x=>[x.name,x.ev]),[['A',120],['B',50],['현금성 자산',30]]);
});
test('full rebalance moves to target and nets to ~zero',()=>{
 const items=[{name:'주식',ev:700},{name:'현금',ev:300}],r=C.rebalance(items,{주식:60,현금:40},{band:5});
 assert.equal(r.rows[0].adj,-100);assert.equal(r.rows[1].adj,100);assert.equal(r.rows[0].flag,true);
 assert.ok(Math.abs(r.rows.reduce((n,x)=>n+x.adj,0))<=items.length);
});
test('targets not summing to 100 are normalized',()=>{const r=C.rebalance([{name:'A',ev:50},{name:'B',ev:50}],{A:30,B:10});assert.equal(r.rows[0].tn,.75);assert.equal(r.rows[0].adj,25);});
test('no targets means no flags and no trades',()=>{const r=C.rebalance([{name:'A',ev:50}],{});assert.equal(r.rows[0].adj,0);assert.equal(r.rows[0].flag,false);});
test('inflow mode only buys and spends the whole amount',()=>{
 const r=C.rebalance([{name:'A',ev:700},{name:'B',ev:300}],{A:50,B:50},{mode:'inflow',inflow:400});
 assert.equal(r.rows[0].adj,0);assert.equal(r.rows[1].adj,400);
 const r2=C.rebalance([{name:'A',ev:500},{name:'B',ev:500}],{A:50,B:50},{mode:'inflow',inflow:200});
 assert.equal(r2.rows.reduce((n,x)=>n+x.adj,0),200);assert.ok(r2.rows.every(x=>x.adj>=0));
 const r3=C.rebalance([{name:'A',ev:900},{name:'B',ev:100}],{A:50,B:50},{mode:'inflow',inflow:300});
 assert.equal(r3.rows.reduce((n,x)=>n+x.adj,0),300);
});
test('ttm uses only the last 365 days',()=>{
 const now=1790928000,d=86400,list=[{t:now-400*d,a:5},{t:now-300*d,a:2},{t:now-10*d,a:3},{t:now-5*d,a:0}];
 const r=C.ttm(list,now);assert.equal(r.sum,5);assert.equal(r.count,2);assert.equal(r.last,now-10*d);
});
test('byMonth buckets by Korea month',()=>{
 const t=Date.UTC(2026,2,31,16,0,0)/1000; // 2026-04-01 01:00 KST
 const out=C.byMonth([{t,a:10}],3);assert.equal(out[3],30);assert.equal(out[2],0);
});
test('capital gain tax applies deduction and rate, losses net out',()=>{
 assert.deepEqual(C.capGainTax({gain:10000000,realized:0,deduction:2500000,rate:.22}),{net:10000000,taxable:7500000,tax:1650000,room:0});
 assert.equal(C.capGainTax({gain:1000000,realized:0}).tax,0);assert.equal(C.capGainTax({gain:1000000}).room,1500000);
 assert.equal(C.capGainTax({gain:-5000000,realized:3000000}).taxable,0);
});
