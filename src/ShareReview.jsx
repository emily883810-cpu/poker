import {useMemo,useState} from 'react';
import {Copy,Share2,Download} from 'lucide-react';
import {Modal} from './HandEditor';
import {makeShareHand,reviewLink} from './share.js';
import {download} from './api';
export default function ShareReview({hand,onClose}){
 const local=['localhost','127.0.0.1'].includes(location.hostname);
 const [base,setBase]=useState(import.meta.env.VITE_COACH_VIEWER_URL||(local?'':location.origin+location.pathname)),[anonymize,setAnon]=useState(true),[includeNotes,setNotes]=useState(false),[status,setStatus]=useState('');
 const shared=useMemo(()=>makeShareHand(hand,{anonymize,includeNotes}),[hand,anonymize,includeNotes]);
 let link='',error='';try{if(base)link=reviewLink(base,shared)}catch(e){error=e.message}
 async function copy(){try{await navigator.clipboard.writeText(link);setStatus('已複製連結，可以傳畀 coach')}catch{setStatus('未能自動複製，請長按下方連結複製')}}
 async function share(){try{await navigator.share({title:'Poker OS · Hand review',url:link})}catch(e){if(e.name!=='AbortError')setStatus('未能開啟分享，請改用複製連結')}}
 return <Modal title="分享呢一手畀 Coach" onClose={onClose}><p>Coach 可用手機逐街播放；毋須登入你嘅私人資料庫。</p><label className="checkbox"><input type="checkbox" checked={anonymize} onChange={e=>setAnon(e.target.checked)}/> 隱藏原玩家名稱及手牌標題（建議）</label><label className="checkbox"><input type="checkbox" checked={includeNotes} onChange={e=>setNotes(e.target.checked)}/> 包含復盤筆記（傳送前請自行檢查）</label><p className="hint">只包含本手牌、標籤及你選擇嘅筆記。原始手記、教材、其他手牌及登入資料不會放入連結。牌面及座位仍可被辨識；匿名選項不等於完全去識別化。</p><label className="field-label">已發布嘅檢視頁網址<input aria-label="Coach 檢視頁網址" value={base} onChange={e=>{setBase(e.target.value);setStatus('')}} placeholder="https://你的網站/"/></label>{!base&&<p className="hint">你目前喺本機。Coach 連唔到你嘅 localhost；先啟用免費 GitHub Pages 檢視頁，或填入已發布網頁地址。可以先下載 JSON，之後喺檢視頁讀入。</p>}{error&&<p className="error" role="alert">{error}</p>}{link&&<><label className="field-label">分享連結<textarea aria-label="Coach 分享連結" readOnly rows="3" value={link}/></label><div className="share-actions"><button className="primary" onClick={copy}><Copy size={16}/> 複製連結</button>{typeof navigator.share==='function'&&<button onClick={share}><Share2 size={16}/> 手機分享</button>}</div></>}<button className="full" onClick={()=>download('coach-review.json',shared)}><Download size={15}/> 下載本手牌 JSON</button><div className="analysis-note"><b>連結只在瀏覽器讀取</b><p>手牌放喺網址 # 後面，不會隨網頁請求傳送到檢視頁伺服器；但連結本身包含可還原手牌，持有者都可以睇。連結沒有到期或撤回功能，請只傳畀指定 coach。</p></div>{status&&<p role="status">{status}</p>}</Modal>
}
