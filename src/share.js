import {validateHand} from './poker.js';
const LIMIT=16000;
export function makeShareHand(hand,{includeNotes=false,anonymize=true}={}){
 validateHand(hand);
 const names=new Map(hand.players.map((p,i)=>[p.name,anonymize?(p.name==='Hero'?'Hero':`Villain ${i+1}`):p.name]));
 const clean={id:'coach-review',title:anonymize?'Coach review':hand.title,site:hand.site,stakes:hand.stakes,currency:hand.currency,maxSeats:hand.maxSeats,dealer:hand.dealer,completed:true,players:hand.players.map(p=>({seat:p.seat,name:names.get(p.name),position:p.position||'',stack:p.stack,cards:p.cards||[],...(p.cardsNote?{cardsNote:p.cardsNote}:{}),...(p.stackKnown===false?{stackKnown:false}:{})})),board:hand.board,actions:hand.actions.map(a=>({street:a.street,player:a.type==='deal'?'':names.get(a.player),type:a.type,amount:a.amount,...(a.note?{note:anonymize?'手記有非標準時點／次序，請向記錄者核對':a.note}:{})})),tags:hand.tags,...(hand.potType?{potType:hand.potType}:{}),notes:includeNotes?hand.notes||'':'',...(hand.settlement?{settlement:hand.settlement}:{}),...(hand.boardNote?{boardNote:hand.boardNote}:{}),...(hand.reconstructed?{reconstructed:true,reviewWarnings:['此手牌由文字手記轉換；座號為位置示意，請核對重建內容與原始紀錄。']}:{})};
 return validateHand(clean);
}
export function encodeReview(hand){
 const bytes=new TextEncoder().encode(JSON.stringify({v:1,h:hand}));let raw='';for(let i=0;i<bytes.length;i++)raw+=String.fromCharCode(bytes[i]);const encoded=btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');if(encoded.length>LIMIT)throw Error('此手牌連結太長，請改用 JSON 檔案分享，或不包含筆記');return encoded;
}
export function decodeReview(encoded){
 if(!encoded||encoded.length>LIMIT||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error('分享連結格式不正確或過長');
 try{const binary=atob(encoded.replaceAll('-','+').replaceAll('_','/'));const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0))));if(data.v!==1)throw Error('版本不支援');return validateHand(data.h)}catch(e){throw Error(`未能讀取分享手牌：${e.message}`)}
}
export function reviewLink(base,hand){const url=new URL(base);if(url.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:'))throw Error('請使用已發布檢視頁的 HTTPS 網址');if(url.username||url.password)throw Error('網址不應包含帳戶密碼');url.search='';url.hash='review='+encodeReview(hand);return url.href}
