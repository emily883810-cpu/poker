import {convertMarkedNotes,readCards} from './notes.js';
import {validateHand} from './poker.js';

const POS='UTG\\+1|UTG|MP|LJ|HJ|CO|BTN|BU|SB|BB';
const ACTOR=`${POS}|HERO|H|我|VIP`;
const AMOUNT='\\d+(?:\\.\\d+)?[kK]?';
const CARD='(?:[2-9TJQKA](?:[cdhs?♣♦♥♠])?){2}[so]?';
const amount=s=>Math.round(parseFloat(s)*(/k$/i.test(s)?1000:1)*100)/100;
const round=n=>Math.round(n*100)/100;
const pos=s=>s.toUpperCase()==='BU'?'BTN':s.toUpperCase();
const fail=message=>({hand:null,issues:[message],derived:[]});
export const quickExample=`25/50
Hero BTN AKs
CO 150, Hero 500, CO c
K72r
CO x, Hero 400, CO c
4
CO x Hero x
8
CO x Hero x`;

// A local, deterministic shorthand reader. Unknown text is never sent to an AI.
export function convertQuickNotes(raw,options={}){
 if(!raw.trim())return fail('貼上你已完成嘅 hand 就得。');
 if(raw.length>20000)return fail('一手最多 20,000 字，請分開貼。');
 if(/ante|straddle|bomb\s*pot|run\s*(?:it\s*)?twice|雙跑|双跑|未完成|進行中/i.test(raw))return fail('呢種手記涉及未支援嘅額外投入／多組牌面，或手牌未完成，暫時未能直接重播。');
 const text=raw.normalize('NFKC').replace(/\r/g,'').replace(/[，；;→>]/g,',').replace(/\b(all[ -]?in|shove)\b|推晒|全下|全押/gi,'jam').replace(/\b(flop|turn|river)(?:\s*:\s*|\s+)/gi,'\n$1: ').replace(/\b(PF|F|T|R)\s*:\s*/gi,'\n$1: ').trim();
 const header=text.split('\n').find(line=>/\d\s*\/\s*\d/.test(line))||'';
 const unit=header.replace(/\d+(?:\.\d+)?\s*bb\s*(?:eff|effective)\b/gi,'').match(/\b(HKD|RMB|CNY|USD|EUR|BB)\b/i)?.[1]?.toUpperCase();
 const currency=unit==='CNY'?'RMB':unit||options.currency||'籌碼';
 const stated=Number(text.match(/\b(6|9)\s*-?\s*max\b/i)?.[1]);
 const maxSeats=stated||Number(options.maxSeats)||(/\b(LJ|MP|UTG\+1)\b/i.test(text)?9:6);
 const warnings=[];
 if(!unit&&!options.currency)warnings.push('幣別未記，以「籌碼」顯示原數字，沒有換算成 BB 或金錢。');
 if(!stated&&!options.maxSeats)warnings.push(`桌型未記，使用 ${maxSeats} 格位置示意；不代表原桌實際人數。`);
 // Preserve the established adapter and full PF/F/T/R format, now with optional metadata.
 const strict=convertMarkedNotes(text,{...options,currency,maxSeats});
 if(strict.hand){strict.hand.source=raw;strict.hand.reviewWarnings=[...new Set([...warnings,...(strict.hand.reviewWarnings||[]),...strict.derived])];return strict;}
 try{
  const result=readLoose(text,{...options,currency,maxSeats});
  result.hand.source=raw;
  result.hand.reviewWarnings=[...warnings,...result.hand.reviewWarnings];
  return result;
 }catch(e){return fail(e.message)}
}

function readLoose(text,{currency,maxSeats,raiseMode='to'}){
 const blind=text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
 if(!blind)throw Error('只差盲注：加一行例如「50/100」，其他可以照平時寫。');
 if([...text.matchAll(/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?/g)].length>1)throw Error('似乎有多手牌／多組盲注，請一次貼一手。');
 const sb=+blind[1],bb=+blind[2];if(!(sb>0&&bb>=sb))throw Error('盲注未睇明，例如寫「50/100」。');
 const layout=maxSeats===9?['SB','BB','UTG','UTG+1','MP','LJ','HJ','CO','BTN']:['SB','BB','UTG','HJ','CO','BTN'];
 const heroMatch=text.match(new RegExp(`(?:\\bHero\\b|\\bH\\b|我)\\s*(${POS})(?=\\s|\\d|$)`,'i'));
 const heroPosition=heroMatch?pos(heroMatch[1]):null;
 if(/\bhero\b|\bH\b|我/i.test(text)&&!heroPosition)throw Error('只差你嘅位置：例如改成「Hero SB JJ」或者「Hero BTN AKs」。');
 const vipPosition=text.match(new RegExp(`(${POS})\\s+VIP\\b`,'i'))?.[1];
 const players=new Map(),warnings=['自由手記只累加已記動作；未記嘅下注、跟注及派彩不會自動補上。','座號按位置示意；≥ 是已記投入下限，完整 Stack 未知。'];
 const effective=text.match(/(\d+(?:\.\d+)?)\s*bb\s*(?:eff|effective)\b/i);
 if(effective)warnings.push(`手記有效深度 ${effective[1]} BB（${round(+effective[1]*bb)} 籌碼）；未當作每個玩家的完整 Stack。`);
 const add=position=>{
  if(!layout.includes(position))throw Error(`${position} 需要 9 格位置；打開「選填設定」改 9-max 就得。`);
  if(!players.has(position))players.set(position,{name:position===heroPosition?'Hero':position,position,seat:layout.indexOf(position)+1,stack:1,stackKnown:false,cards:[],total:0,put:0,folded:false,acted:false});
  return players.get(position);
 };
 const resolve=token=>{
  const t=pos(token);
  if(['HERO','H','我'].includes(t))return add(heroPosition);
  if(t==='VIP'){if(!vipPosition)throw Error('VIP 未對應到位置，第一次寫「HJ VIP」就得。');return add(pos(vipPosition));}
  return add(t);
 };
 // Discover only explicitly named positions, so omitted blinds can be labelled separately.
 const stripHeader=line=>line.includes(blind[0])?line.replace(/^\d+\.\s*/,'').replace(blind[0],'').replace(/\d+(?:\.\d+)?\s*bb\s*(?:eff|effective)\b/gi,'').replace(/\b(?:HKD|RMB|CNY|USD|EUR|BB|[69]\s*-?\s*max)\b/gi,'').replace(/\b(?:Macau|Live|PokerStars|Zoom|WePoker|GG\s*Poker)\b/gi,'').trim():line;
 const actionText=text.split('\n').map(stripHeader).join('\n');
 const mentioned=new Set([...actionText.matchAll(new RegExp(`\\b(${POS})(?=\\s|\\d|$)`,'gi'))].map(m=>pos(m[1])));
 if(heroPosition)mentioned.add(heroPosition);
 for(const position of mentioned)add(position);
 if(mentioned.size<2)throw Error('只差對手位置：例如「CO 300 Hero BTN 1000 CO c」。');
 const hand={id:`notes-${crypto.randomUUID()}`,title:'文字手記復盤',site:'Live / notes',stakes:`${sb} / ${bb}`,currency,maxSeats,dealer:maxSeats,completed:true,players:[],board:[],actions:[],tags:[],notes:'',source:text,settlement:'unrecorded',reconstructed:true,recordedOnly:true,reviewWarnings:warnings,boardNote:''};
 let street='Preflop',last=null,boardCount=0,seenActions=false,earlyFold=false;
 const action=(p,type,value=0,note)=>{
  if(p.folded)throw Error(`${p.name} 已棄牌，後面仲有佢嘅動作；只需改返呢一段。`);
  if(['bet','raise','call','post'].includes(type)){p.put=round(p.put+value);p.total=round(p.total+value);p.stack=Math.max(p.stack,p.total);}
  if(type==='fold')p.folded=true;
  if(type!=='post')p.acted=true;
  hand.actions.push({street,player:p.name,type,amount:value,...(note?{note}:{})});
 };
 for(const [position,value] of [['SB',sb],['BB',bb]])action(add(position),'post',value);
 for(const position of ['SB','BB'])if(!mentioned.has(position)){
  action(add(position),'fold',0,'未提及此盲注玩家，暫按只付盲注後棄牌；實際時點未記');
  warnings.push(`${position} 未提及，暫按只付盲注後棄牌；如有參與請補佢嘅動作。`);
 }
 const ordered=()=>[...players.values()].filter(p=>!p.folded&&!(p.stackKnown&&p.total>=p.stack)).sort((a,b)=>{
  const index=p=>street==='Preflop'?(layout.indexOf(p.position)+layout.length-2)%layout.length:layout.indexOf(p.position);
  return index(a)-index(b);
 });
 const next=()=>{const list=ordered();if(!list.length)throw Error('已全押後仲有下注動作，請核對。');if(!last)return list[0];const full=street==='Preflop'?[...layout.slice(2),...layout.slice(0,2)]:layout;return list.find(p=>full.indexOf(p.position)>full.indexOf(last))||list[0]};
 const closeStreet=()=>{
  if(!seenActions)return;
  const max=Math.max(...[...players.values()].map(p=>p.put));
  const missing=[...players.values()].filter(p=>!p.folded&&p.put<max&&!(p.stackKnown&&p.total===p.stack));
  if(missing.length)warnings.push(`${street} ${missing.map(p=>p.name).join('、')} 未記齊回應；底池只包括已記投入，未補作 call。`);
 };
 function parseActions(body,line){
  let pending=null;
  while(body.trim()){
   body=body.replace(/^[\s,:|]+/,'');if(!body)break;
   const actor=body.match(new RegExp(`^(${ACTOR})(?=\\s|\\d|$|,)`,'i'));
   if(actor){if(pending)throw Error(`「${line}」有位置但未記動作，例如「HJ c」。`);pending=resolve(actor[1]);body=body.slice(actor[0].length).trim();
    const secondary=body.match(new RegExp(`^(${POS}|VIP)(?=\\s|$)`,'i'));
    if(secondary&&(pending.name==='Hero'||secondary[1].toUpperCase()==='VIP'))body=body.slice(secondary[0].length).trim();
    continue;
   }
   const token=body.match(new RegExp(`^(?:(check|call|fold|raise|bet|open|jam|3bet|3b|r|b|c|x|f)\\s*(?:to\\s*)?(${AMOUNT})?|(${AMOUNT}))(?=\\s|,|$|(?:(?:hero|VIP|${POS})\\b))`,'i'));
   if(!token)throw Error(`呢段未睇明：「${body.slice(0,70)}」。可寫「HJ 6000 Hero jam 18000 c」，唔使填表。`);
   const inferred=!pending,p=pending||next();pending=null;const command=(token[1]||'amount').toLowerCase(),n=token[2]||token[3];const max=Math.max(...[...players.values()].map(p=>p.put));const owed=round(max-p.put);let type,value=0;
   if(['x','check'].includes(command)){type='check';if(n||owed>0)throw Error(`${p.name} 面對下注，未能當作 check；請核對 x 前面嘅位置。`);}
   else if(['f','fold'].includes(command)){type='fold';if(n)throw Error('Fold 後面唔使寫金額。');}
   else if(['c','call'].includes(command)){type='call';if(owed<=0)throw Error(`${p.name} 前面未見下注，呢個 c 未能計算；補返下注金額就得。`);value=n?amount(n):owed;if(value!==owed)throw Error(`${p.name} 呢次跟注差額係 ${owed}，同手記唔一致；請核對。`);}
   else {
    if(!n)throw Error(`${p.name} ${command} 只差金額，例如「jam 18k」。`);
    const target=amount(n);value=raiseMode==='increment'?target:round(target-p.put);
    if(value<=0)throw Error(`${p.name} 加注金額低於已投入額，請核對。`);
    type=max>0?'raise':'bet';
    if(command==='jam'){
     p.stack=round(p.total+value);p.stackKnown=true;
     if(round(p.put+value)===max)type='call';
    }
    if(type==='raise'&&round(p.put+value)<=max)throw Error(`${p.name} 加注需高於 ${max}，請核對。`);
   }
   if(p.stackKnown&&round(p.total+value)>p.stack)throw Error(`${p.name} 已全押，後面唔應再投入；請核對。`);
   // An explicitly noted out-of-turn middle-player fold does not advance the action pointer.
   if(earlyFold&&['bet','raise'].includes(type)&&street==='Flop'){
    const candidate=ordered().filter(q=>q!==p&&q.name!=='Hero');
    if(candidate.length!==1)throw Error('「中間玩家提前 fold」未能對應唯一位置；補寫例如「LJ f」就得。');
    action(p,type,value);action(candidate[0],'fold',0,'手記標示中間玩家提前棄牌，實際時點待核對');earlyFold=false;
   }else action(p,type,value,inferred?'未寫玩家，按目前已記位置及動作輪序對應，請核對':undefined);
   last=p.position;seenActions=true;body=body.slice(token[0].length);
  }
  if(pending)throw Error(`${pending.name} 後面只差動作，例如 c / x / 6000。`);
 }
 let lines=text.split('\n').map(s=>s.trim()).filter(Boolean);
 for(let line of lines){
  line=stripHeader(line);if(!line)continue;
  if(/^(?:HKD|RMB|USD|EUR|[69]\s*-?\s*max)$/i.test(line))continue;
  if(/^(?:notes?|筆記|結果|result)\s*:/i.test(line)){hand.notes+=(hand.notes?'\n':'')+line;continue;}
  // Retain result descriptions without inventing a payout or winner calculation.
  const result=line.match(new RegExp(`^(${ACTOR})\\s*(${CARD})(?:\\s+(.+))?$`,'i'));
  if(result){const parsed=readCards(result[2],2),p=resolve(result[1]);p.cards=parsed.cards;p.cardsNote=parsed.note;hand.notes+=(hand.notes?'\n':'')+line;continue;}
  const heroCards=line.match(new RegExp(`(?:\\bHero\\b|\\bH\\b|我)\\s*(${POS})\\s+(?:w(?:ith)?\\s*)?(${CARD})(?=\\s|$)`,'i'));
  if(heroCards){const parsed=readCards(heroCards[2],2),p=add(heroPosition);p.cards=parsed.cards;p.cardsNote=parsed.note;line=line.replace(heroCards[0],'').trim();if(!line)continue;}
  // Cards embedded after an action: "Hero SB 1000 w QQ".
  const withCards=line.match(new RegExp(`\\bw(?:ith)?\\s+(${CARD})(?=\\s|$)`,'i'));
  if(withCards){if(!heroPosition)throw Error('底牌前面加返你嘅位置，例如「Hero SB 1000 w QQ」。');const parsed=readCards(withCards[1],2);add(heroPosition).cards=parsed.cards;add(heroPosition).cardsNote=parsed.note;line=line.replace(withCards[0],'');}
  line=line.replace(/[（(]([^）)]*)[）)]/g,(_,note)=>{if(/提前.*(?:fold|f左|f咗|棄|直f)/i.test(note))earlyFold=true;else warnings.push(`保留註記，未轉成動作：${note}`);hand.notes+=(hand.notes?'\n':'')+note;return ''}).trim();
  const label=line.match(/^(PF|preflop|翻前|F|flop|翻牌|T|turn|轉牌|R|river|河牌)\s*:\s*/i);
  if(label)line=line.slice(label[0].length);
  const expected=boardCount===0?3:1;
  const cardHead=line.match(new RegExp(`^((?:[2-9TJQKA](?:[cdhs?♣♦♥♠])?\\s*){${expected}}r?)(?=\\s|\\||,|$)`,'i'));
  if(cardHead&&(!label||!/^(pf|preflop|翻前)$/i.test(label[1]))){
   if(boardCount>=5)throw Error('牌面多過五張，請每手分開貼。');
   const targetStreet=boardCount===0?'Flop':boardCount===3?'Turn':'River';
   if(label){const name=label[1].toLowerCase();const target=/^(f|flop|翻牌)$/.test(name)?'Flop':/^(t|turn|轉牌)$/.test(name)?'Turn':/^(r|river|河牌)$/.test(name)?'River':'';if(target!==targetStreet)throw Error('牌面街道次序唔一致，請依 Flop、Turn、River 排列。');}
   closeStreet();const parsed=readCards(cardHead[1],expected);hand.board.push(...parsed.cards);boardCount+=expected;street=targetStreet;last=null;seenActions=false;players.forEach(p=>p.put=0);hand.actions.push({street,player:'',type:'deal',amount:0});if(parsed.note)hand.boardNote+=(hand.boardNote?'；':'')+`${street}: ${parsed.note}`;
   line=line.slice(cardHead[0].length).replace(/^[\s|,]+/,'');if(!line)continue;
  }else if(label&&!/^(pf|preflop|翻前)$/i.test(label[1]))throw Error('呢一街只差牌面，例如「Flop: K72r」或者直接寫「K72r」。');
  if(!line)continue;
  parseActions(line,line);
 }
 closeStreet();if(!hand.actions.some(a=>!['post','fold','deal'].includes(a.type)))throw Error('仲未讀到入池動作，例如「CO 300 Hero BTN 1000 CO c」。');
 if(earlyFold)throw Error('提前棄牌註記未對應到動作，補寫棄牌位置，例如「LJ f」。');
 hand.players=[...players.values()].map(({total,put,folded,acted,...p})=>p);
 const hero=hand.players.find(p=>p.name==='Hero');hand.title=`${hero?.cards.map(c=>c[0]).join('')||'文字手記'} · 復盤`;
 return {hand:validateHand(hand),issues:[],derived:warnings};
}
