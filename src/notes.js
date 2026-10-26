import {replay,validateHand} from './poker.js';
export const notesExample=`WePoker 5/10 RMB 6-max
Hero BTN 1000 AhKh
SB 1000
BB 1200
PF: Hero r25, SB f, BB c
F: Qh Jh 2c | BB x, Hero b40, BB c
T: 3d | BB x, Hero x
R: Ts | BB b100, Hero r300, BB c
Result: Hero win 735`;
const positions=['UTG','UTG+1','MP','LJ','HJ','CO','BTN','SB','BB'];
const rounded=n=>Math.round(n*100)/100;
export function readCards(text,expected){
 let s=text.replace(/10/gi,'T').replace(/♠/g,'s').replace(/♥/g,'h').replace(/♦/g,'d').replace(/♣/g,'c').replace(/[\s\[\],]/g,'');
 let note='';
 if(expected===2&&/^[2-9TJQKA]{2}[so]$/i.test(s)){if(s[0].toUpperCase()===s[1].toUpperCase()&&s.at(-1).toLowerCase()==='s')throw Error('口袋對子不能標示為 suited');note=s.at(-1).toLowerCase()==='s'?'手記標示 suited，實際花色未記':'手記標示 offsuit，實際花色未記';s=s.slice(0,2);}
 else if(expected===3&&/^[2-9TJQKA]{3}[r]$/i.test(s)){note='手記標示 rainbow，實際花色未記';s=s.slice(0,3);}
 const cards=[];
 while(s){const m=s.match(/^([2-9TJQKA])([cdhs?]?)/i);if(!m)throw Error(`無法辨識牌面：${text}`);cards.push(m[1].toUpperCase()+(m[2]?.toLowerCase()||'?'));s=s.slice(m[0].length);}
 if(cards.length!==expected)throw Error(`需要 ${expected} 張牌：${text}`);
 if(cards.some(c=>c[1]==='?')&&!note)note='實際花色未記';
 return {cards,note};
}
export function convertNotes(text,{raiseMode='to',currency='',maxSeats=null}={}){
 const issues=[],derived=[];const hand={id:`notes-${Date.now().toString(36)}`,title:'文字手記復盤',site:'Live / notes',stakes:'',currency:'',maxSeats:6,dealer:1,completed:true,players:[],board:[],actions:[],tags:[],notes:'',source:text,settlement:'unrecorded',boardNote:'',reconstructed:true,reviewWarnings:['座號按位置示意，並非原桌座號。']};
 let blinds=null,tableSpecified=false;
 const actionLines=[];let result=null;const lines=text.split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line||line.startsWith('#'))continue;
  try{
   let m;
   if((m=line.match(/^(?:PF|PREFLOP|F|FLOP|T|TURN|R|RIVER|翻前|翻牌|轉牌|河牌)\s*[:：]/i))){actionLines.push({line,i:i+1});continue;}
   if((m=line.match(/^(?:result|結果)\s*[:：]\s*(.+)$/i))){if(result)throw Error('結果只能記一行');result=m[1];continue;}
   if((m=line.match(/^(?:notes?|筆記)\s*[:：]\s*(.*)$/i))){hand.notes+=(hand.notes?'\n':'')+m[1];continue;}
   if((m=line.match(/^(?:tags?|標籤)\s*[:：]\s*(.*)$/i))){hand.tags=m[1].split(/[,，]/).map(t=>t.trim()).filter(Boolean);continue;}
   if((m=line.match(/^(?:title|標題)\s*[:：]\s*(.*)$/i))){hand.title=m[1];continue;}
   if(/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?/.test(line)){
    if(blinds)throw Error('盲注設定重複');
    if(/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*\//.test(line)||/ante|straddle|bomb|雙跑|双跑/i.test(line))throw Error('此轉換器未支援 Ante、Straddle、Bomb pot 或雙跑牌，請勿省略額外投入');
    const bm=line.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);blinds=[+bm[1],+bm[2]];if(!(blinds[0]>0&&blinds[1]>=blinds[0]))throw Error('盲注金額不正確');
    const fmt=line.match(/\b(6|9)[ -]?max\b/i);if(fmt){hand.maxSeats=+fmt[1];tableSpecified=true;}else if([6,9].includes(+maxSeats)){hand.maxSeats=+maxSeats;tableSpecified=true;}
    const cur=line.match(/\b(USD|HKD|RMB|CNY|EUR|BB)\b/i);hand.currency=cur?cur[1].toUpperCase():currency;if(hand.currency==='CNY')hand.currency='RMB';
    hand.site=line.slice(0,bm.index).trim()||'Live / notes';hand.stakes=`${blinds[0]} / ${blinds[1]}`;continue;
   }
   if((m=line.match(/^(Hero|H|Villain|V|UTG\+1|UTG|MP|LJ|HJ|CO|BTN|BU|SB|BB)\s+(?:(UTG\+1|UTG|MP|LJ|HJ|CO|BTN|BU|SB|BB)\s+)?(\d+(?:\.\d+)?)(?:\s+(.+))?$/i))){
    let name=m[1].toUpperCase();name=['H','HERO'].includes(name)?'Hero':['V','VILLAIN'].includes(name)?'Villain':name==='BU'?'BTN':name;
    let position=(m[2]||(['Hero','Villain'].includes(name)?'':name)).toUpperCase();if(position==='BU')position='BTN';if(!position)throw Error(`${name} 請補上位置，例如 Hero BTN 1000 AKs`);
    if(hand.players.some(p=>p.name===name||p.position===position))throw Error('玩家／位置重複');
    const hole=m[4]?readCards(m[4],2):{cards:[],note:''};hand.players.push({name,position,stack:+m[3],cards:hole.cards,cardsNote:hole.note,seat:0});continue;
   }
   throw Error('未能辨識；請使用玩家行、PF/F/T/R 街道或 Notes: 筆記行');
  }catch(e){issues.push(`第 ${i+1} 行：${e.message}`)}
 }
 if(!blinds)issues.push('請補盲注，例如 WePoker 5/10 RMB 6-max');
 if(!hand.currency)issues.push('請明確填入金額單位 USD / HKD / RMB / EUR / BB；不會自動換算 BB');
 if(!tableSpecified)issues.push('請明確填入 6-max 或 9-max');
 if(hand.players.length<2)issues.push('至少填入兩名玩家及各自起始 Stack');
 const layout=hand.maxSeats===6?['SB','BB','UTG','HJ','CO','BTN']:['SB','BB','UTG','UTG+1','MP','LJ','HJ','CO','BTN'];
 for(const p of hand.players){if(!layout.includes(p.position))issues.push(`${p.position} 不屬於此桌型的位置，請核對`);p.seat=layout.indexOf(p.position)+1;}
 hand.dealer=hand.maxSeats;
 if(!hand.players.some(p=>p.position==='SB')||!hand.players.some(p=>p.position==='BB'))issues.push('請記錄 SB 及 BB 的起始 Stack（包括已棄牌的盲注玩家），才能正確計算底池');
 if(issues.length)return {hand:null,issues,derived};
 const resolve=actor=>{let key=actor.trim().toUpperCase();if(['H','HERO'].includes(key))key='Hero';if(['V','VILLAIN'].includes(key))key='Villain';if(key==='BU')key='BTN';const p=hand.players.find(p=>p.name===key||p.position===key);if(!p)throw Error(`未有玩家 ${actor} 的座位及 Stack`);return p;};
 for(const [position,amount] of [['SB',blinds[0]],['BB',blinds[1]]])hand.actions.push({street:'Preflop',player:resolve(position).name,type:'post',amount});
 derived.push(`按已填盲注加入 SB ${blinds[0]}、BB ${blinds[1]}；R 金額解讀為${raiseMode==='to'?'加注至總額':'本次額外投入'}。`);
 let previous=-1;
 for(const {line,i} of actionLines){try{
  const prefix=line.match(/^([^:：]+)[:：]\s*(.*)$/);const key=prefix[1].toUpperCase();const street=/^(PF|PREFLOP|翻前)$/.test(key)?'Preflop':/^(F|FLOP|翻牌)$/.test(key)?'Flop':/^(T|TURN|轉牌)$/.test(key)?'Turn':'River';const idx=['Preflop','Flop','Turn','River'].indexOf(street);
  if(idx<=previous)throw Error('街道重複或次序不正確');previous=idx;
  let body=prefix[2];if(idx>0){const parts=body.split('|');if(parts.length!==2)throw Error('公共牌與動作請用 | 分開，例如 F: Q72r | BB x, Hero b40');const n=idx===1?3:1;const parsed=readCards(parts[0],n);if(hand.board.length!==idx+1&&idx!==1)throw Error('缺少前一街公共牌');hand.board.push(...parsed.cards);hand.actions.push({street,player:'',type:'deal',amount:0});if(parsed.note)hand.boardNote+=(hand.boardNote?'；':'')+`${street}: ${parsed.note}`;body=parts[1];}
  for(const raw of body.split(/[,，;；]/).map(s=>s.trim()).filter(Boolean)){
   const m=raw.match(/^(\S+)\s+(x|check|過牌|f|fold|棄牌|c|call|跟注|b|bet|下注|r|raise|加注|return|退回)\s*(?:to\s*)?(\d+(?:\.\d+)?)?$/i);if(!m)throw Error(`動作未能辨識：${raw}；請用 BB x / Hero b40 / BB c / Hero r120`);
   const p=resolve(m[1]);const aliases={x:'check',check:'check','過牌':'check',f:'fold',fold:'fold','棄牌':'fold',c:'call',call:'call','跟注':'call',b:'bet',bet:'bet','下注':'bet',r:'raise',raise:'raise','加注':'raise',return:'return','退回':'return'};const type=aliases[m[2].toLowerCase()];
   const state=replay(hand,hand.actions.length);const current=state.players.find(x=>x.name===p.name);if(current.folded)throw Error(`${p.name} 已棄牌，不能再行動`);const sameStreet=state.street===street;const own=sameStreet?current.streetPut:0;const max=sameStreet?Math.max(...state.players.map(x=>x.streetPut)):0;const owed=rounded(max-own);let amount=m[3]===undefined?null:+m[3];
   if(['check','fold'].includes(type)){if(amount)throw Error('Check/Fold 不應有下注額');amount=0;if(type==='check'&&owed>0)throw Error(`${p.name} 面對下注，不能 check`);}
   else if(type==='call'){if(owed<=0)throw Error('沒有需要跟注的金額，請核對動作');if(amount===null){amount=Math.min(owed,current.remaining);derived.push(`${street} ${p.name} call ${amount}：由當街差額計算。`);}if(amount!==Math.min(owed,current.remaining))throw Error(`Call 應為本次投入 ${Math.min(owed,current.remaining)}；不會自行修正已填金額`);}
   else {if(amount===null||amount<=0)throw Error(`${type} 請填入金額`);if(type==='raise'&&raiseMode==='to')amount=rounded(amount-own);if(type==='bet'&&max>0)throw Error('已有下注，請用 raise 而非 bet');if(type==='raise'&&own+amount<=max)throw Error('Raise 總額必須高於當街已有下注');}
   hand.actions.push({street,player:p.name,type,amount});replay(hand,hand.actions.length,true);
  }
 }catch(e){issues.push(`第 ${i} 行：${e.message}`);break;}}
 if(!actionLines.length)issues.push('請加入 PF/F/T/R 動作記錄');
 if(!issues.length&&result){try{const m=result.match(/^(\S+)\s+(?:win|wins|collect|獲得|贏)\s+(\d+(?:\.\d+)?)$/i);if(!m)throw Error('請用 Result: Hero win 735，填實際派彩；未記派彩可刪除此行');const p=resolve(m[1]);hand.actions.push({street:hand.actions.at(-1).street,player:p.name,type:'collect',amount:+m[2]});delete hand.settlement;}catch(e){issues.push(`結果：${e.message}`)}}
 if(hand.settlement==='unrecorded')derived.push('未記實際派彩／抽水：保留最後動作底池，不推定贏家或自動派彩。');
 if(hand.boardNote||hand.players.some(p=>p.cardsNote))derived.push('有牌面未記實際花色，以 ? 顯示；原手記的 suited / offsuit / rainbow 描述會保留。');
 try{if(!issues.length)validateHand(hand)}catch(e){issues.push(e.message)}
 return {hand:issues.length?null:hand,issues,derived};
}

export const markedExample=`1. 25/50 160bb eff
lj 150 hj VIP c Hero sb 1000 w QQ c c
366r
x x VIP 2.5k hero jam 7k c （中間玩家提前fold）
4
8
HJ 86o we lost`;
// A deliberately narrow adapter for the user's supplied shorthand, not an AI parser.
export function convertMarkedNotes(text,options={}){
 if(!/bb\s+eff\b/i.test(text))return convertNotes(text,options);
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const header=lines[0]?.match(/^(?:\d+\.\s*)?(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)bb\s+eff$/i);
 const pf=lines[1]?.match(/^lj\s+(\d+(?:\.\d+)?)\s+hj\s+VIP\s+c\s+Hero\s+sb\s+(\d+(?:\.\d+)?)\s+w\s+([2-9TJQKA]{2}[so]?)\s+c\s+c$/i);
 const flop=lines[3]?.match(/^x\s+x\s+VIP\s+(\d+(?:\.\d+)?k?)\s+hero\s+jam\s+(\d+(?:\.\d+)?k?)\s+c\s*[（(](?:夾中間戈家提前直f左|中間玩家提前fold)[）)]$/i);
 const result=lines[6]?.match(/^HJ\s+([2-9TJQKA]{2}[so]?)\s+we\s+lost$/i);
 if(!header||!pf||!flop||!result||lines.length!==7)return {hand:null,issues:['此縮寫格式尚未完整辨識。請按範例格式補寫，或用 PF/F/T/R 格式；不會猜測缺漏動作。'],derived:[]};
 const issues=[];if(!['HKD','RMB','USD','EUR','BB'].includes(options.currency))issues.push('原手記未寫幣別，請在上方選擇');if(![6,9].includes(+options.maxSeats))issues.push('原手記未寫桌型，請選 6-max 或 9-max');
 const number=s=>Number(s.replace(/k$/i,''))*(/k$/i.test(s)?1000:1);
 const sb=+header[1],bb=+header[2],effective=+header[3]*bb,raise=+pf[2],jam=number(flop[2]);
 if(rounded(raise+jam)!==effective)issues.push('有效 Stack 與翻前投入 + flop jam 金額不一致，請核對');
 if(issues.length)return {hand:null,issues,derived:[]};
 const canonical=`Live ${sb}/${bb} ${options.currency} ${options.maxSeats}-max\nHero SB ${effective} ${pf[3]}\nBB ${bb}\nLJ ${raise}\nHJ ${effective} ${result[1]}\nPF: LJ r${pf[1]}, HJ c, Hero r${raise}, BB f, LJ c, HJ c\nF: ${lines[2]} | Hero x, LJ x, HJ b${number(flop[1])}, LJ f, Hero r${jam}, HJ c\nT: ${lines[4]} |\nR: ${lines[5]} |\nNotes: 手記結果 HJ ${result[1]}，Hero 輸；未記實際派彩及抽水。`;
 const parsed=convertNotes(canonical,{raiseMode:'to'});
 if(!parsed.hand)return parsed;
 const h=parsed.hand;h.source=text;h.title=`${pf[3].toUpperCase()} vs HJ · 3BP 3-way`;h.potType='3BP 3-way';h.reconstructed=true;
 for(const p of h.players)if(p.name!=='Hero')p.stackKnown=false;
 const fold=h.actions.find(a=>a.player==='LJ'&&a.type==='fold');fold.note='手記標示提前棄牌；目前放在 VIP 下注後，須核對時點';
 h.reviewWarnings=['原手記未寫完整 Stack：BB、LJ、HJ 只記錄可證實的最低投入額，不代表實際剩餘 Stack。','按手記重建為 Hero SB / LJ / HJ 三人入 Flop；BB 翻前棄牌、只計盲注死錢。尾段 c c 及提前棄牌時點仍請核對。','座號按位置示意，並非原桌座號。'];
 parsed.derived=[...h.reviewWarnings,...parsed.derived];return parsed;
}
