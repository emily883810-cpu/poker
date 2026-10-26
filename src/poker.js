export const streets = ['Preflop','Flop','Turn','River'];
export const money = n => Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const round = n => Math.round(n*100)/100;
const cardRE = /^[2-9TJQKA][cdhs?]$/;
export function validateHand(h) {
  if (!h || h.completed !== true) throw Error('只接受已完成手牌，請確認 completed=true。');
  if(typeof h.id!=='string'||! /^[A-Za-z0-9_.-]{1,100}$/.test(h.id)) throw Error('Hand ID 只接受英數、點、底線、連字號（最長100字）。');
  for(const k of ['title','site','stakes','currency']) if(typeof h[k]!=='string'||h[k].length>500) throw Error(`${k} 必須為文字。`);
  if(!Array.isArray(h.tags)||h.tags.some(t=>typeof t!=='string'||t.length>100)||typeof (h.notes||'')!=='string') throw Error('Tags 必須為文字陣列，notes 必須為文字。');
  if (![6,9].includes(h.maxSeats)) throw Error('桌型必須為 6-max 或 9-max。');
  if(!Number.isInteger(h.dealer)||h.dealer<1||h.dealer>h.maxSeats) throw Error('Button 座號不正確。');
  if (!Array.isArray(h.players) || h.players.length<2 || h.players.length>h.maxSeats) throw Error('座位數不正確。');
  const names = new Set(), seats = new Set(), cards=[];
  for (const p of h.players) {
    if (typeof p.name!=='string'||!p.name||p.name.length>100||names.has(p.name) || !Number.isInteger(p.seat) || p.seat<1 || p.seat>h.maxSeats || seats.has(p.seat) || !Number.isFinite(p.stack) || p.stack<=0) throw Error('玩家名稱、座號不可重複，Stack 必須大於 0。');
    if(p.position!==undefined&&typeof p.position!=='string') throw Error('Position 必須為文字。');
    if(p.cardsNote!==undefined&&typeof p.cardsNote!=='string') throw Error('底牌說明必須為文字。');
    if(p.stackKnown!==undefined&&typeof p.stackKnown!=='boolean') throw Error('Stack 已知狀態格式不正確。');
    names.add(p.name); seats.add(p.seat);
    if (p.cards && (!Array.isArray(p.cards)||![0,2].includes(p.cards.length))) throw Error('已知底牌必須為兩張。');
    cards.push(...(p.cards||[]));
  }
  if (!Array.isArray(h.board)||![0,3,4,5].includes(h.board.length)) throw Error('公共牌必須為 0、3、4 或 5 張。');
  cards.push(...h.board);
  if(cards.some(c=>typeof c!=='string'||!cardRE.test(c)) || new Set(cards.filter(c=>c[1]!=='?')).size!==cards.filter(c=>c[1]!=='?').length || [...new Set(cards.map(c=>c[0]))].some(r=>cards.filter(c=>c[0]===r).length>4)) throw Error('牌面格式錯誤或有重複牌（例如 As、Th）。');
  if(h.boardNote!==undefined&&typeof h.boardNote!=='string') throw Error('牌面說明必須為文字。');
  if(h.potType!==undefined&&typeof h.potType!=='string') throw Error('底池類型必須為文字。');
  if(h.reviewWarnings!==undefined&&(!Array.isArray(h.reviewWarnings)||h.reviewWarnings.length>30||h.reviewWarnings.some(x=>typeof x!=='string'))) throw Error('重建說明格式不正確。');
  if(!Array.isArray(h.actions)||(!h.actions.length||h.actions.length>1000)) throw Error('動作數必須在 1–1000 之間。');
  let st=0;
  for(const a of h.actions){
    const idx=streets.indexOf(a.street);
    if(idx<st || idx<0 || (idx>0 && h.board.length<idx+2)) throw Error('動作街序或公共牌不完整。');
    st=idx;
    if((a.type!=='deal'&&!names.has(a.player))||!['post','bet','call','raise','check','fold','return','collect','deal'].includes(a.type)) throw Error('不支援的玩家或動作。');
    if(a.note!==undefined&&typeof a.note!=='string') throw Error('動作說明必須為文字。');
    if(!Number.isFinite(a.amount)||a.amount<0) throw Error('下注金額必須為非負數。');
    if(['check','fold','deal'].includes(a.type)&&a.amount!==0) throw Error('Check/Fold 金額應為 0。');
  }
  if(!h.actions.some(a=>a.type==='collect')&&h.settlement!=='unrecorded') throw Error('完成手牌必須記錄 collect 派彩（含分池）。');
  replay(h,h.actions.length,true);
  return h;
}
// Every amount is an increment, including raises; independent street contributions retained.
export function replay(h,step,strict=false){
  const players=h.players.map(p=>({...p,remaining:p.stack,invested:0,streetPut:0,folded:false,last:''}));
  let pot=0, street='Preflop', paid=0;
  for(const a of h.actions.slice(0,step)){
    if(a.street!==street){players.forEach(p=>{p.streetPut=0;p.last='';});street=a.street;}
    if(a.type==='deal')continue;
    const p=players.find(p=>p.name===a.player);
    if(!p) throw Error('Unknown player');
    p.last=a.type;
    if(['post','bet','call','raise'].includes(a.type)){
      if(strict && (p.folded||a.amount>p.remaining+0.001)) throw Error(`${p.name} 下注超過剩餘 Stack 或已棄牌。`);
      p.remaining=round(p.remaining-a.amount);p.invested=round(p.invested+a.amount);p.streetPut=round(p.streetPut+a.amount);pot=round(pot+a.amount);
    }else if(a.type==='return'){
      if(strict && a.amount>p.streetPut+0.001) throw Error('未跟注退回額超過當街投入。');
      p.remaining=round(p.remaining+a.amount);p.invested=round(p.invested-a.amount);p.streetPut=round(p.streetPut-a.amount);pot=round(pot-a.amount);
    }else if(a.type==='collect'){
      if(strict && a.amount>pot+0.001) throw Error('派彩超過底池。');
      p.remaining=round(p.remaining+a.amount);pot=round(pot-a.amount);paid=round(paid+a.amount);
    }else if(a.type==='fold')p.folded=true;
  }
  const active=players.filter(p=>!p.folded).map(p=>p.remaining).sort((a,b)=>b-a);
  let effective=active.length>1?active[1]:0;
  const live=players.filter(p=>!p.folded);let effectiveKnown=live.every(p=>p.stackKnown!==false);
  if(live.length===2&&!effectiveKnown){const exact=live.find(p=>p.stackKnown!==false),other=live.find(p=>p.stackKnown===false);if(exact&&other&&exact.remaining<=other.remaining){effectiveKnown=true;effective=exact.remaining;}}
  const levels=[...new Set(players.map(p=>p.invested).filter(x=>x>0))].sort((a,b)=>a-b);
  let prev=0;
  const layers=levels.map(level=>{const eligible=players.filter(p=>p.invested>=level);const amount=round((level-prev)*eligible.length);prev=level;return {amount,eligible:eligible.filter(p=>!p.folded).map(p=>p.name)};});
  const pots=[];
  for(const layer of layers){const last=pots.at(-1);if(last&&last.eligible.join('\0')===layer.eligible.join('\0'))last.amount=round(last.amount+layer.amount);else pots.push(layer);}
  const n=streets.indexOf(street);
  return {players,pot,street,effective,effectiveKnown,spr:effectiveKnown&&pot>0&&active.length>1?effective/pot:null,board:h.board.slice(0,n===0?0:n+2),pots,paid};
}

export function parseHistory(text){
  text=text.trim();
  if(text.startsWith('{')||text.startsWith('[')){
    const data=JSON.parse(text);return (Array.isArray(data)?data:[data]).map(validateHand);
  }
  const chunks=text.split(/(?=^(?:PokerStars (?:Zoom )?Hand #|Poker Hand #))/m).filter(x=>x.trim());
  return chunks.map(parseTextHand);
}
function parseTextHand(text){
  if(!/^PokerStars (?:Zoom )?Hand #|^Poker Hand #/.test(text)) throw Error('目前支援英文 PokerStars／GGPoker 相容文字格式或 Poker OS JSON。');
  if(/FIRST |SECOND |THIRD |run it|runs twice|bomb pot|straddle|posts dead|posts missed/i.test(text)) throw Error('尚未支援雙跑牌、Bomb pot、Straddle 或補盲格式。');
  if(!text.includes('*** SUMMARY ***')) throw Error('缺少 SUMMARY；不匯入未完成手牌。');
  if(!/Hold.em/.test(text) || /Omaha|Tournament|Short Deck/i.test(text)) throw Error('第一版只支援 Cash No Limit Hold’em。');
  const maxSeats=Number(text.match(/(6|9)-max/)?.[1]);
  const dealer=Number(text.match(/Seat #(\d+) is the button/)?.[1]);
  const num=s=>Number(s.replace(/[^\d.]/g,''));
  const players=[...text.matchAll(/^Seat (\d+): (.+?) \(([^)]+?) in chips\)/gm)].map(m=>({seat:+m[1],name:m[2],stack:num(m[3]),position:''}));
  if(!players.length)throw Error('無法辨識 Seat / in chips 格式。');
  const ordered=[...players].sort((a,b)=>a.seat-b.seat);const di=ordered.findIndex(p=>p.seat===dealer);
  const labels=players.length===2?['BTN/SB','BB']:players.length===6?['BTN','SB','BB','UTG','HJ','CO']:players.length===9?['BTN','SB','BB','UTG','UTG+1','MP','LJ','HJ','CO']:['BTN','SB','BB',...Array.from({length:players.length-3},(_,i)=>`EP${i+1}`)];
  if(di>=0) ordered.forEach((_,i)=>ordered[(di+i)%ordered.length].position=labels[i]);
  const actions=[];let street='Preflop', board=[], puts={};let summary=false;
  const sorted=[...players].sort((a,b)=>b.name.length-a.name.length);
  for(const line of text.split('\n')){
    if(line.startsWith('*** SUMMARY')){summary=true;continue;}
    if(summary)continue;
    const marker=line.match(/^\*\*\* (FLOP|TURN|RIVER) \*\*\* (.+)/);
    if(marker){street={FLOP:'Flop',TURN:'Turn',RIVER:'River'}[marker[1]];board=[...marker[2].matchAll(/\[([^\]]+)\]/g)].flatMap(m=>m[1].split(/\s+/));puts={};actions.push({street,player:'',type:'deal',amount:0});continue;}
    const dealt=line.match(/^Dealt to (.+) \[([^\]]+)\]/);if(dealt){const p=players.find(p=>p.name===dealt[1]);if(p)p.cards=dealt[2].split(' ');continue;}
    const ret=line.match(/^Uncalled bet \(([^)]+)\) returned to (.+)$/);
    if(ret){actions.push({street,player:ret[2],type:'return',amount:num(ret[1])});puts[ret[2]]=(puts[ret[2]]||0)-num(ret[1]);continue;}
    const p=sorted.find(p=>line.startsWith(p.name+': ')||line.startsWith(p.name+' collected '));if(!p)continue;
    const rest=line.slice(p.name.length).replace(/^(?:: | )/,'');
    let type,amount=0;
    if(rest.startsWith('collected ')){type='collect';amount=num(rest.match(/^collected ([\d$€£¥,.]+)/)?.[1]||'');}
    else if(rest.startsWith('shows ')){const m=rest.match(/\[([^\]]+)\]/);if(m)p.cards=m[1].split(' ');continue;}
    else if(rest.startsWith('folds'))type='fold';
    else if(rest.startsWith('checks'))type='check';
    else if(/^posts (small blind|big blind|the ante|ante)/.test(rest)){type='post';amount=num(rest.match(/([\d$€£¥,.]+)(?: and is all-in)?$/)?.[1]||'');}
    else if(rest.startsWith('calls ')||rest.startsWith('bets ')){type=rest.startsWith('calls')?'call':'bet';amount=num(rest.match(/^(?:calls|bets) ([\d$€£¥,.]+)/)?.[1]||'');}
    else if(rest.startsWith('raises ')){type='raise';const target=num(rest.match(/ to ([\d$€£¥,.]+)/)?.[1]||'');amount=round(target-(puts[p.name]||0));}
    else if(/mucks|doesn't show|sits out|is sitting out/.test(rest))continue;
    else throw Error(`不支援的動作：${line}`);
    if(type==='post' && /ante/.test(rest))throw Error('Ante 格式尚未支援，請用 JSON 明確記錄。');
    if(['post','bet','call','raise'].includes(type))puts[p.name]=(puts[p.name]||0)+amount;
    actions.push({street,player:p.name,type,amount});
  }
  const id=text.match(/Hand #([^: ]+)/)?.[1];
  return validateHand({id:`${text.startsWith('PokerStars')?'PS':'GG'}-${id}`,title:`${text.startsWith('PokerStars')?'PokerStars':'GGPoker'} #${id}`,site:text.startsWith('PokerStars')?'PokerStars':'GGPoker',stakes:text.split('\n')[0].match(/\(([^)]+)\)/)?.[1]||'Cash',currency:/HKD/.test(text)?'HKD':/RMB|CNY/.test(text)?'RMB':/EUR|€/.test(text)?'EUR':'USD',maxSeats,dealer,players,board,actions,tags:[],notes:'',completed:true,source:text});
}

export const demo = {
  id:'demo-zoom-001',title:'QQ · Turn pot control',site:'PokerStars',stakes:'NL50 Zoom · 0.25 / 0.50',currency:'USD',maxSeats:6,dealer:6,completed:true,tags:['B-X-B','3BP OOP R'],notes:'示範手牌，不是真實玩家紀錄。',
  players:[{seat:1,name:'Northstar',position:'SB',stack:50},{seat:2,name:'Hero',position:'BB',stack:56.5,cards:['Qs','Qh']},{seat:3,name:'QuietRiver',position:'UTG',stack:48.25},{seat:4,name:'StackTheory',position:'HJ',stack:62.1},{seat:5,name:'BlueHour',position:'CO',stack:50},{seat:6,name:'RiverPilot',position:'BTN',stack:54.75}],
  board:['As','9h','6c','2d','Qc'],actions:[
    ['Preflop','Northstar','post',.25],['Preflop','Hero','post',.5],['Preflop','QuietRiver','fold',0],['Preflop','StackTheory','fold',0],['Preflop','BlueHour','fold',0],['Preflop','RiverPilot','raise',1.25],['Preflop','Northstar','fold',0],['Preflop','Hero','raise',4.5],['Preflop','RiverPilot','call',3.75],
    ['Flop','Hero','bet',3.25],['Flop','RiverPilot','call',3.25],['Turn','Hero','check',0],['Turn','RiverPilot','check',0],['River','Hero','bet',12],['River','RiverPilot','fold',0],['River','Hero','return',12],['River','Hero','collect',16.75]
  ].map(([street,player,type,amount])=>({street,player,type,amount}))
};
