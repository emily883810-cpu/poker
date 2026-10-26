import test from 'node:test';
import assert from 'node:assert/strict';
import {understandingRequest,readAssistantHand,looksLikeAssistantResult} from '../src/assistantImport.js';
import {demo} from '../src/poker.js';
import {makeShareHand,reviewLink} from '../src/share.js';

test('free handoff preserves arbitrary notes as data and never requires a shorthand template',()=>{
 const raw='頭先我喺掣位攞兩隻Q，前面個客開咗三百，我返九百。\n之後佢話自己唔記得邊張turn。';
 const request=understandingRequest(raw,{currency:'HKD'});const data=JSON.parse(request.slice(request.indexOf('{\n  "handNotes"')));assert.equal(data.handNotes,raw);assert.equal(data.hints.currency,'HKD');assert.match(request,/先只問一個具體問題/);assert.match(request,/不根據勝負或牌力推算實際派彩/);assert.throws(()=>understandingRequest(''));assert.throws(()=>understandingRequest('x'.repeat(20001)));
});
test('assistant code block validates a hand, preserves raw notes and labels transcription as unverified',()=>{
 const raw='我平時亂咁寫嘅手記';const input=structuredClone(demo);input.unexpected='ignore arbitrary assistant metadata';const h=readAssistantHand('呢個係整理結果：\n```json\n'+JSON.stringify(input)+'\n```',{originalNotes:raw});assert.ok(h.id.startsWith('understood-'));assert.notEqual(h.id,readAssistantHand(JSON.stringify(input)).id);assert.equal(h.source,raw);assert.equal(h.unexpected,undefined);assert.equal(h.recordedOnly,true);assert.equal(h.reconstructed,true);assert.deepEqual(h.actions,demo.actions);assert.ok(h.reviewWarnings[0].includes('尚未逐動作人工核對'));assert.deepEqual(h.board,demo.board);
});
test('invalid, unfinished, or ambiguous assistant responses never become fabricated replays',()=>{
 assert.throws(()=>readAssistantHand('18k 係額外定總額？'),/追問/);assert.throws(()=>readAssistantHand(JSON.stringify({...demo,completed:false})),/已完成/);assert.throws(()=>readAssistantHand(JSON.stringify({...demo,actions:[...demo.actions,{street:'River',player:'nobody',type:'call',amount:100}]})),/玩家/);assert.throws(()=>readAssistantHand(JSON.stringify([demo,demo])),/一手/);assert.throws(()=>readAssistantHand('```json\n{}\n```\n```json\n{}\n```'),/一手/);
});
test('single-hand envelopes, pasted replay URLs and detection work without external requests',()=>{
 assert.deepEqual(readAssistantHand(JSON.stringify({hand:demo})).board,demo.board);assert.deepEqual(readAssistantHand(JSON.stringify([demo])).board,demo.board);const share=makeShareHand(demo),url=reviewLink('https://example.com/poker/',share);assert.deepEqual(readAssistantHand(url),share);assert.throws(()=>readAssistantHand('https://example.com/poker/'),/冇包含/);assert.equal(looksLikeAssistantResult('```json\n{}\n```'),true);assert.equal(looksLikeAssistantResult('50/100 Hero SB'),false);
});

test('conversation CLI creates and verifies an anonymised link without exporting source or private notes',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {decodeReview}=await import('../src/share.js');
 const hand={...structuredClone(demo),notes:'private review',source:'private free-form hand'};
 const run=spawnSync(process.execPath,['scripts/create_review_link.mjs'],{input:JSON.stringify(hand),encoding:'utf8'});assert.equal(run.status,0,run.stderr);const url=new URL(run.stdout.trim());assert.equal(url.origin,'https://emily883810-cpu.github.io');const decoded=decodeReview(url.hash.slice(8));assert.equal(decoded.notes,'');assert.equal(decoded.source,undefined);assert.equal(decoded.title,'Coach review');assert.ok(decoded.players.every(p=>p.name==='Hero'||p.name.startsWith('Villain ')));assert.equal(decoded.recordedOnly,true);
 const bad=spawnSync(process.execPath,['scripts/create_review_link.mjs'],{input:'hand still in progress',encoding:'utf8'});assert.equal(bad.status,1);assert.equal(bad.stdout,'');
});
