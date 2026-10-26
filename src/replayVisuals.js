import {money} from './poker.js';

const NINE=[[50,92],[16,82],[14,57],[16,32],[32,9],[68,9],[84,32],[86,57],[84,82]];
const SIX=[[50,90],[16,72],[16,27],[50,9],[84,27],[84,72]];
const NINE_BETS=[[50,80],[33,76],[18,67],[18,44],[36,21],[64,21],[82,44],[82,67],[67,76]];
const SIX_BETS=[[50,77],[29,65],[28,37],[50,24],[72,37],[71,65]];
const POSITIONS={6:['BTN','SB','BB','UTG','HJ','CO'],9:['BTN','SB','BB','UTG','UTG+1','MP','LJ','HJ','CO']};
const rounded=n=>Math.round(n*100)/100;

// Fill physical slots for presentation only. Missing seats never enter replay accounting.
export function tableSeats(hand){
 const anchor=hand.players.find(p=>p.name==='Hero')?.seat||hand.players[0].seat;
 return Array.from({length:hand.maxSeats},(_,i)=>{
  const seat=i+1,index=(seat-anchor+hand.maxSeats)%hand.maxSeats;
  const [x,y]=(hand.maxSeats===9?NINE:SIX)[index];
  const position=POSITIONS[hand.maxSeats][(seat-hand.dealer+hand.maxSeats)%hand.maxSeats];
  return {seat,x,y,position,player:hand.players.find(p=>p.seat===seat)||null,
   // Bets sit just inside the rail, still associated with their owner's seat.
   bet:{x:(hand.maxSeats===9?NINE_BETS:SIX_BETS)[index][0],y:(hand.maxSeats===9?NINE_BETS:SIX_BETS)[index][1]}};
 });
}

export function tableMoney(hand,state,step){
 const paid=hand.actions.slice(0,step).some(a=>a.type==='collect');
 const bets=paid?[]:state.players.filter(p=>p.streetPut>0);
 const streetTotal=rounded(bets.reduce((n,p)=>n+p.streetPut,0));
 return {bets,streetTotal,banked:Math.max(0,rounded(state.pot-streetTotal))};
}

// Both a single-step button and autoplay use this same movement plan. Seeking never calls it.
export function chipTransfers(hand,before,after,step){
 const slots=tableSeats(hand),moves=[];
 const slotFor=p=>slots.find(s=>s.seat===p.seat);
 if(before.street!==after.street){
  for(const p of before.players.filter(p=>p.streetPut>0))moves.push({kind:'sweep',from:slotFor(p).bet,to:{x:50,y:43},amount:p.streetPut,player:p.name});
 }
 const a=hand.actions[step-1],p=after.players.find(p=>p.name===a?.player);
 if(!p||!a.amount)return moves;
 const slot=slotFor(p);
 if(['post','bet','raise','call'].includes(a.type))moves.push({kind:'push',from:slot,to:slot.bet,amount:a.amount,player:p.name});
 if(a.type==='return')moves.push({kind:'return',from:slot.bet,to:slot,amount:a.amount,player:p.name});
 if(a.type==='collect')moves.push({kind:'payout',from:{x:50,y:43},to:slot,amount:a.amount,player:p.name});
 return moves;
}

export function actionCaption(hand,state,step){
 const a=hand.actions[step-1];
 if(!a)return {actor:'準備重播',label:`${hand.maxSeats}-MAX`,detail:'按播放，逐步睇籌碼同動作'};
 if(a.type==='deal')return {actor:state.street.toUpperCase(),label:'發牌',detail:''};
 const p=state.players.find(p=>p.name===a.player);
 const allIn=p?.stackKnown!==false&&p?.remaining===0&&['bet','raise','call'].includes(a.type);
 const names={post:'POST',bet:'BET',raise:'RAISE TO',call:'CALL',check:'CHECK',fold:'FOLD',return:'退回',collect:'收取派彩'};
 return {actor:a.player,label:allIn?'ALL-IN':names[a.type],
  detail:a.amount?`${money(a.type==='raise'?p.streetPut:a.amount)}${a.type==='raise'?`（本次 +${money(a.amount)}）`:''}`:''};
}

// A stable pseudo-random illustration: play/seek, save/reload and anonymised sharing
// all choose the same suits. Only explicitly rainbow, unknown FLOP suits are filled.
// Raw cards, turn/river, hand evaluation and exported data remain untouched.
export function illustrativeBoard(hand){
 const original=[...hand.board];
 if(original.length<3||!/rainbow|彩虹/i.test(hand.boardNote||'')||!original.slice(0,3).some(c=>c[1]==='?'))return {board:original,indices:[]};
 const known=[...hand.board,...hand.players.flatMap(p=>p.cards||[])].filter(c=>c[1]!=='?');
 let seed=2166136261;
 for(const c of [...original,...known.slice().sort()].join(''))seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const shuffle=()=>{const suits=['h','s','d','c'];for(let i=3;i>0;i--){const j=Math.floor(random()*(i+1));[suits[i],suits[j]]=[suits[j],suits[i]];}return suits};
 const board=[...original],usedCards=new Set(known),usedSuits=new Set();
 function assign(i){
  if(i===3)return true;
  if(original[i][1]!=='?'){
   const suit=original[i][1];if(usedSuits.has(suit))return false;
   usedSuits.add(suit);const ok=assign(i+1);usedSuits.delete(suit);return ok;
  }
  for(const suit of shuffle()){
   const card=original[i][0]+suit;
   if(usedSuits.has(suit)||usedCards.has(card))continue;
   board[i]=card;usedSuits.add(suit);usedCards.add(card);
   if(assign(i+1))return true;
   usedSuits.delete(suit);usedCards.delete(card);
  }
  board[i]=original[i];return false;
 }
 if(!assign(0))return {board:original,indices:[]};
 return {board,indices:[0,1,2].filter(i=>original[i][1]==='?')};
}
