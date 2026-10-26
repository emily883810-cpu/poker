import test from 'node:test';
import assert from 'node:assert/strict';
import {convertQuickNotes,quickExample} from '../src/quickNotes.js';
import {markedExample,notesExample} from '../src/notes.js';
import {replay,validateHand} from '../src/poker.js';
import {makeShareHand,encodeReview,decodeReview} from '../src/share.js';

test('one paste works without currency, table, stacks or street labels',()=>{
 const {hand:h,issues}=convertQuickNotes(quickExample);assert.deepEqual(issues,[]);assert.equal(h.currency,'籌碼');assert.equal(h.maxSeats,6);assert.equal(h.recordedOnly,true);assert.equal(replay(h,h.actions.length).pot,1875);assert.equal(replay(h,h.actions.length).spr,null);assert.deepEqual(h.board,['K?','7?','2?','4?','8?']);assert.ok(h.players.every(p=>p.stackKnown===false));assert.ok(h.reviewWarnings.some(x=>x.includes('桌型未記')));assert.ok(h.reviewWarnings.some(x=>x.includes('SB 未提及')));assert.equal(h.actions.some(a=>a.type==='collect'),false);
});
test('established three-way shorthand keeps dead BB money and exact pot without mandatory metadata',()=>{
 const {hand:h,issues}=convertQuickNotes(markedExample);assert.deepEqual(issues,[]);assert.equal(h.title,'QQ vs HJ · 3BP 3-way');assert.equal(h.maxSeats,9);const pre=replay(h,h.actions.findIndex(a=>a.street==='Flop'));assert.equal(pre.pot,3050);assert.equal(pre.players.filter(p=>!p.folded).length,3);assert.equal(replay(h,h.actions.length).pot,17050);assert.equal(h.currency,'籌碼');
});
test('spacing, punctuation, all-in spelling, street words and anonymous actions are tolerated',()=>{
 const variant=markedExample.replace('25/50','25 / 50').replace('160bb','160 bb').replace('hero jam 7k','hero all in 7k');const r=convertQuickNotes(variant);assert.deepEqual(r.issues,[]);assert.equal(replay(r.hand,r.hand.actions.length).pot,17050);assert.equal(r.hand.currency,'籌碼');assert.equal(r.hand.players.find(p=>p.position==='BB').stackKnown,false);
 const h=convertQuickNotes('5/10\nHero BTN AKs\nHero r30 BB c\nflop Q72r BB x，Hero b40，c\nturn 3 x x\nriver T BB x Hero x').hand;assert.ok(h);assert.equal(h.currency,'籌碼');assert.equal(replay(h,h.actions.length).pot,145);assert.ok(h.actions.some(a=>a.note?.includes('未寫玩家')));
});
test('missing responses remain missing, rather than invented calls or payouts',()=>{
 const h=convertQuickNotes('25/50\nHero BTN AKs\nCO 150 Hero 500\nK72r\nCO x Hero 400\n4\n8').hand;assert.ok(h);assert.equal(replay(h,h.actions.length).pot,1125);assert.equal(h.actions.some(a=>a.type==='call'),false);assert.ok(h.reviewWarnings.some(x=>x.includes('未記齊回應')));assert.equal(h.recordedOnly,true);
});
test('genuinely unclear input asks for one relevant correction and retains no fabricated hand',()=>{
 assert.match(convertQuickNotes('Hero BTN AKs\nBB c').issues[0],/盲注/);assert.match(convertQuickNotes('5/10\nHero AKs BB c').issues[0],/位置/);assert.match(convertQuickNotes(quickExample.replace('Hero 400','Hero something')).issues[0],/something/);assert.equal(convertQuickNotes(quickExample.replace('CO c','CO c2')).hand,null);assert.equal(convertQuickNotes(quickExample+'\nstraddle 100').hand,null);assert.equal(convertQuickNotes(quickExample.replace('K72r','KKKr').replace('AKs','KK')).hand,null);
});
test('recorded-only disclosure survives coach sharing with no source or private text',()=>{
 const h=convertQuickNotes(quickExample).hand;h.notes='private';const shared=decodeReview(encodeReview(makeShareHand(h)));assert.equal(shared.recordedOnly,true);assert.equal(shared.source,undefined);assert.equal(shared.notes,'');assert.ok(shared.reviewWarnings.some(x=>x.includes('盲注')));assert.throws(()=>validateHand({...shared,recordedOnly:'true'}));
});
test('full generic format remains exact, and explicit metadata wins over optional defaults',()=>{
 const h=convertQuickNotes(notesExample,{currency:'HKD',maxSeats:9}).hand;assert.ok(h);assert.equal(h.currency,'RMB');assert.equal(h.maxSeats,6);assert.equal(replay(h,h.actions.length).pot,0);
 const o=convertQuickNotes(quickExample,{currency:'HKD',maxSeats:9}).hand;assert.equal(o.currency,'HKD');assert.equal(o.maxSeats,9);
});
