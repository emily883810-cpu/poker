import test from 'node:test';
import assert from 'node:assert/strict';
import {demo,replay,validateHand,parseHistory} from '../src/poker.js';
const clone=()=>structuredClone(demo);
test('demo balances pot, returned bet and final stacks',()=>{validateHand(clone());assert.equal(replay(demo,11).pot,16.75);const final=replay(demo,17);assert.equal(final.pot,0);assert.equal(final.players.find(p=>p.name==='Hero').remaining,65);assert.equal(final.players.reduce((n,p)=>n+p.remaining,0),demo.players.reduce((n,p)=>n+p.stack,0))});
test('board only reveals current street and seek is deterministic',()=>{assert.equal(replay(demo,9).board.length,0);assert.equal(replay(demo,10).board.length,3);assert.equal(replay(demo,12).board.length,4);assert.deepEqual(replay(demo,10),replay(demo,10));assert.equal(replay(demo,11).spr,46.5/16.75)});
test('rejects incomplete hands, impossible cards, overbets and overpayments',()=>{for(const mutate of [h=>h.completed=false,h=>h.players[0].cards=['As','Kh'],h=>h.actions[0].amount=100,h=>h.actions.at(-1).amount=1000,h=>h.actions[0].street='Turn']){const h=clone();mutate(h);assert.throws(()=>validateHand(h))}});
test('9-max JSON roundtrips',()=>{const h=clone();h.maxSeats=9;h.players.push(...[7,8,9].map(seat=>({seat,name:`P${seat}`,stack:50})));assert.equal(parseHistory(JSON.stringify(h))[0].players.length,9)});
test('all-in investment layers retain folded contributions and eligibility',()=>{const h={players:[{name:'A',stack:20},{name:'B',stack:50},{name:'C',stack:50}],board:[],actions:[{street:'Preflop',player:'A',type:'bet',amount:20},{street:'Preflop',player:'B',type:'call',amount:50},{street:'Preflop',player:'C',type:'call',amount:50},{street:'Preflop',player:'C',type:'fold',amount:0}]};const s=replay(h,4);assert.deepEqual(s.pots,[{amount:60,eligible:['A','B']},{amount:60,eligible:['B']}]);assert.equal(s.pot,120)});
const fixture=`PokerStars Zoom Hand #123: Hold'em No Limit ($0.25/$0.50 USD) - 2026/10/27
Table 'Private' 6-max Seat #1 is the button
Seat 1: Hero ($50 in chips)
Seat 2: Villain ($50 in chips)
Hero: posts small blind $0.25
Villain: posts big blind $0.50
*** HOLE CARDS ***
Dealt to Hero [Qs Qh]
Hero: raises $1 to $1.50
Villain: calls $1
*** FLOP *** [As 9h 6c]
Villain: checks
Hero: bets $1
Villain: folds
Uncalled bet ($1) returned to Hero
Hero collected $3 from pot
*** SUMMARY ***
Total pot $3 | Rake $0`;
test('PokerStars parser converts raise-to to increment and returns uncalled bet',()=>{const h=parseHistory(fixture)[0];assert.equal(h.actions[2].amount,1.25);assert.equal(h.players[0].position,'BTN/SB');assert.equal(replay(h,h.actions.length).pot,0);assert.equal(parseHistory(fixture+'\n\n'+fixture.replace('#123','#124')).length,2)});
test('GGPoker compatible header parses separately',()=>{assert.equal(parseHistory(fixture.replace('PokerStars Zoom Hand #123','Poker Hand #RC123'))[0].id,'GG-RC123')});
test('unsupported variant or incomplete history fails explicitly',()=>{assert.throws(()=>parseHistory(fixture.replace('*** SUMMARY ***','SUMMARY')));assert.throws(()=>parseHistory(fixture.replace("Hold'em",'Omaha')));assert.throws(()=>parseHistory('WePoker raw unsupported'))});

test('unknown empty hole cards remain valid for manual live hands',()=>{const h=clone();h.players.forEach(p=>p.cards=[]);assert.doesNotThrow(()=>validateHand(h))});
