import test from 'node:test';
import assert from 'node:assert/strict';
import {tableSeats,tableMoney,chipTransfers,actionCaption,illustrativeBoard} from '../src/replayVisuals.js';
import {convertQuickNotes} from '../src/quickNotes.js';
import {markedExample} from '../src/notes.js';
import {replay,demo} from '../src/poker.js';
import {makeShareHand} from '../src/share.js';
const hand=()=>convertQuickNotes(markedExample).hand;

test('all nine physical slots remain visible without adding players or chips to the hand',()=>{
 const h=hand(),before=JSON.stringify(h),slots=tableSeats(h);assert.equal(slots.length,9);assert.equal(slots.filter(s=>!s.player).length,5);assert.deepEqual(slots.map(s=>s.seat),[1,2,3,4,5,6,7,8,9]);assert.equal(slots.find(s=>s.player?.name==='Hero').x,50);assert.equal(slots.find(s=>s.position==='BTN').seat,9);assert.equal(JSON.stringify(h),before);assert.equal(tableSeats(demo).length,6);
});
test('current-street chips and banked pot sum to the pot, including folded players and returns',()=>{
 const h=hand();for(let step=0;step<=h.actions.length;step++){const state=replay(h,step),m=tableMoney(h,state,step);assert.equal(m.banked+m.streetTotal,state.pot)}
 const step=h.actions.findIndex(a=>a.player==='Hero'&&a.street==='Flop'&&a.type==='raise')+1,state=replay(h,step),m=tableMoney(h,state,step);assert.equal(state.pot,12550);assert.equal(m.banked,3050);assert.equal(m.streetTotal,9500);assert.equal(m.bets.find(p=>p.name==='Hero').streetPut,7000);
 const beforeReturn=tableMoney(demo,replay(demo,15),15),afterReturn=tableMoney(demo,replay(demo,16),16);assert.equal(beforeReturn.streetTotal,12);assert.equal(afterReturn.streetTotal,0);assert.equal(afterReturn.banked,16.75);assert.equal(chipTransfers(demo,replay(demo,15),replay(demo,16),16)[0].amount,12);
 const paid=tableMoney(demo,replay(demo,demo.actions.length),demo.actions.length);assert.deepEqual(paid.bets,[]);assert.equal(paid.streetTotal,0);assert.equal(paid.banked,0);
});
test('push animations move incremental amounts; street changes sweep existing bets without a second accounting entry',()=>{
 const h=hand(),pf=h.actions.findIndex(a=>a.player==='Hero'&&a.type==='raise')+1;
 const moves=chipTransfers(h,replay(h,pf-1),replay(h,pf),pf);assert.equal(moves.length,1);assert.equal(moves[0].amount,975);assert.equal(moves[0].kind,'push');assert.notDeepEqual(moves[0].from,moves[0].to);
 const flop=h.actions.findIndex(a=>a.street==='Flop')+1,sweep=chipTransfers(h,replay(h,flop-1),replay(h,flop),flop);assert.ok(sweep.every(m=>m.kind==='sweep'));assert.equal(sweep.reduce((n,m)=>n+m.amount,0),3050);
 const final=chipTransfers(demo,replay(demo,demo.actions.length-1),replay(demo,demo.actions.length),demo.actions.length);assert.equal(final.at(-1).kind,'payout');assert.equal(final.at(-1).amount,demo.actions.at(-1).amount);
});
test('raise-to and all-in captions distinguish total street bet from this action increment',()=>{
 const h=hand(),step=h.actions.findIndex(a=>a.player==='Hero'&&a.type==='raise')+1;const c=actionCaption(h,replay(h,step),step);assert.equal(c.label,'RAISE TO');assert.match(c.detail,/1,000.00.*975.00/);const jam=h.actions.findIndex(a=>a.player==='Hero'&&a.type==='raise'&&a.street==='Flop')+1;assert.equal(actionCaption(h,replay(h,jam),jam).label,'ALL-IN');
});
test('rainbow illustration is coloured, stable across coach sharing, and never changes raw cards',()=>{
 const h=hand(),original=JSON.stringify(h),visual=illustrativeBoard(h);assert.equal(visual.indices.length,3);assert.equal(new Set(visual.board.slice(0,3).map(c=>c[1])).size,3);assert.ok(visual.board.slice(0,3).some(c=>'hd'.includes(c[1])));assert.deepEqual(visual.board.slice(3),['4?','8?']);assert.deepEqual(illustrativeBoard(h),visual);assert.deepEqual(illustrativeBoard(makeShareHand(h)),visual);assert.equal(JSON.stringify(h),original);
});
test('illustration honours real cards and impossible or unspecified textures stay untouched',()=>{
 const h=hand();h.board=['A?','A?','A?','2?','3?'];h.players[0].cards=['Ah','Ks'];const v=illustrativeBoard(h);assert.equal(new Set([...v.board.slice(0,3),'Ah']).size,4);assert.ok(v.board.slice(0,3).every(c=>c!=='Ah'));
 const known={...h,board:['As','Kh','Qc','2?','3?']};assert.deepEqual(illustrativeBoard(known).indices,[]);assert.deepEqual(illustrativeBoard({...h,boardNote:''}).board,h.board);
 const conflict={...h,board:['As','Ks','Q?']};assert.deepEqual(illustrativeBoard(conflict),{board:conflict.board,indices:[]});
});
