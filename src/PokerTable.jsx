import {useMemo,useState,useEffect,useRef} from 'react';
import {money,replay} from './poker.js';
import {tableSeats,tableMoney,chipTransfers,actionCaption,illustrativeBoard} from './replayVisuals.js';

const suits={s:'♠',h:'♥',d:'♦',c:'♣'};
export function Card({value,small=false,illustrative=false}){
 return <span className={`card ${small?'small':''} ${value?`suit-${value[1]}`:'back'} ${illustrative?'illustrative':''}`} data-illustrative={illustrative||undefined} title={illustrative?'示意花色；原記錄的實際花色仍然未知':undefined}>
  {value?<><b>{value[0]==='T'?'10':value[0]}</b><span>{suits[value[1]]||'?'}</span></>:'♠'}
 </span>;
}
function Chips(){return <span className="chip-stack" aria-hidden="true"><i/><i/><i/></span>}

export default function PokerTable({hand,state,step,reveal,speed}){
 const slots=useMemo(()=>tableSeats(hand),[hand]);
 const illustration=useMemo(()=>illustrativeBoard(hand),[hand]);
 const [showIllustration,setShowIllustration]=useState(true),[motion,setMotion]=useState(null);
 const previous=useRef({hand,step}),serial=useRef(0);
 useEffect(()=>{
  const prev=previous.current;previous.current={hand,step};
  // Render motion only for a forward single step, never a rewind or a timeline jump.
  if(prev.hand===hand&&step===prev.step+1){
   const moves=chipTransfers(hand,replay(hand,prev.step),state,step);
   setMotion(moves.length?{key:++serial.current,moves}:null);
  }else setMotion(null);
 },[hand,state,step]);
 const last=hand.actions[step-1],caption=actionCaption(hand,state,step),moneyState=tableMoney(hand,state,step);
 const board=showIllustration?illustration.board:hand.board;
 return <>
  <div className="table-heading"><b>{hand.maxSeats}-MAX <span>· {hand.maxSeats} 個座位</span></b><span>{hand.players.length} 人有紀錄{hand.reconstructed?' · 位置示意':''}</span></div>
  <div className={`action-banner action-${last?.type||'ready'}`} aria-live="polite" aria-atomic="true"><b>{caption.actor}</b><span>{caption.label}</span><strong>{caption.detail}</strong></div>
  <div className="table-scroll"><div className={`table-stage poker-table seats-${hand.maxSeats}`} aria-label={`${hand.maxSeats}-max 完整牌桌`}>
   <div className="felt"><div className="table-brand">POKER / OS · {hand.maxSeats}-MAX</div></div>
   <div className="table-center"><div className="pot"><span>{hand.recordedOnly?'Pot · 已記投入':hand.settlement==='unrecorded'&&step===hand.actions.length?'Pot · 派彩未記':'Total pot'}</span><strong>{money(state.pot)} <small>{hand.currency}</small></strong><div className="pot-breakdown">已收 {money(moneyState.banked)} <i/> 當街 {money(moneyState.streetTotal)}</div></div>
    <div className="board" title={hand.boardNote||''}>{Array.from({length:5},(_,i)=><Card key={i} value={i<state.board.length?board[i]:undefined} illustrative={i<state.board.length&&showIllustration&&illustration.indices.includes(i)}/>)}</div>
    {showIllustration&&illustration.indices.length>0&&state.board.length>0?<small className="illustration-badge">Rainbow 示意花色</small>:null}
    <div className="street-caption">{state.street.toUpperCase()} <i/> {step} / {hand.actions.length}</div>
   </div>
   {slots.map(slot=>{
    const p=state.players.find(p=>p.seat===slot.seat);
    return <div key={slot.seat} data-player={p?.name} data-seat={slot.seat} aria-label={`座位 ${slot.seat} · ${p?.name||'未記錄'}`} className={`seat ${!p?'seat-placeholder':''} ${p?.name==='Hero'?'hero':''} ${p?.folded?'folded':''} ${p&&last?.player===p.name?'active':''}`} style={{left:`${slot.x}%`,top:`${slot.y}%`}}>
     <div className="seat-head"><span className="position">{p?.position|| (hand.reconstructed?slot.position:`S${slot.seat}`)}</span><span>{slot.seat===hand.dealer?<i className="dealer">D</i>:null} #{slot.seat}</span></div>
     <div className="seat-body"><div><b>{p?.name||'未記錄玩家'}</b><strong>{p?`${p.stackKnown===false?'≥ ':''}${money(p.remaining)}`:'Stack —'}</strong></div><div className="hole-cards">{[0,1].map(i=><Card key={i} small value={p&&(reveal||p.name==='Hero')?p.cards?.[i]:undefined}/>)}</div></div>
     <div className={`seat-action ${p?.last||''}`}>{!p?'無動作紀錄':p.folded?'FOLD':p.remaining===0&&p.stackKnown!==false?'ALL-IN':p.last|| (step===hand.actions.length?'記錄結束':'等待動作')}</div>
    </div>;
   })}
   {moneyState.bets.map(p=>{
    const slot=slots.find(s=>s.seat===p.seat);
    return <div className={`street-bet ${last?.player===p.name?'current-bet':''}`} key={p.seat} data-player={p.name} aria-label={`${p.name} 當街已投入 ${money(p.streetPut)}`} style={{left:`${slot.bet.x}%`,top:`${slot.bet.y}%`}}><Chips/><b>{money(p.streetPut)}</b></div>;
   })}
   {motion&&<div key={motion.key} className="chip-motion" aria-hidden="true">{motion.moves.map((move,i)=><div key={i} className={`chip-flight ${move.kind}`} data-kind={move.kind} style={{'--from-left':`${move.from.x}%`,'--from-top':`${move.from.y}%`,'--to-left':`${move.to.x}%`,'--to-top':`${move.to.y}%`,'--flight-time':`${Math.min(550,speed*.8)}ms`}}><Chips/>{move.kind!=='sweep'&&<b>{move.kind==='return'?'退回 ':move.kind==='payout'?'收取 ': '+'}{money(move.amount)}</b>}</div>)}</div>}
  </div></div>
  {illustration.indices.length>0&&<div className="illustration-control"><label><input type="checkbox" checked={showIllustration} onChange={e=>setShowIllustration(e.target.checked)}/> Rainbow 示意花色</label><small>只用於顯示，原花色仍未知；Turn／River 未記花色會保留 ?。</small></div>}
  <p className="table-seat-note">全部 {hand.maxSeats} 個座位均顯示；「未記錄」不代表已知空座或已知玩家，唔會補入底池。籌碼旁金額＝當街累計，移動金額＝本次投入。</p>
 </>;
}
