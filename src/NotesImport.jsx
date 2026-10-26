import {useState} from 'react';
import {ArrowRight,Copy,ExternalLink} from 'lucide-react';
import {Modal} from './HandEditor';
import {markedExample} from './notes.js';
import {convertQuickNotes,quickExample} from './quickNotes.js';
import {understandingRequest,readAssistantHand,looksLikeAssistantResult} from './assistantImport.js';

const DRAFT='poker-os-notes-draft-v1';
function readDraft(){try{const d=JSON.parse(sessionStorage.getItem(DRAFT)||'null');if(!d||typeof d.text!=='string'||d.text.length>1000000)return {};return {text:d.text,currency:['HKD','RMB','USD','EUR','BB'].includes(d.currency)?d.currency:'',maxSeats:['6','9'].includes(d.maxSeats)?d.maxSeats:'',raiseMode:d.raiseMode==='increment'?'increment':'to',stage:d.stage==='assistant'&&d.text.trim()&&d.text.length<=20000?'assistant':'notes'}}catch{return {}}}
export default function NotesImport({onClose,onReview}){
 const [draft]=useState(readDraft);
 const [text,setText]=useState(draft.text||''),[currency,setCurrency]=useState(draft.currency||''),[maxSeats,setMax]=useState(draft.maxSeats||''),[raiseMode,setRaiseMode]=useState(draft.raiseMode||'to'),[issue,setIssue]=useState('');
 const [stage,setStage]=useState(draft.stage||'notes'),[answer,setAnswer]=useState(''),[request,setRequest]=useState(''),[copyMessage,setCopyMessage]=useState(''),[showRequest,setShowRequest]=useState(false);
 const options={currency,maxSeats:Number(maxSeats)||undefined,raiseMode};
 function store(next={}){try{sessionStorage.setItem(DRAFT,JSON.stringify({text,currency,maxSeats,raiseMode,stage,...next}))}catch{/* Private mode may disable storage; the current form still works. */}}
 function review(h){try{sessionStorage.removeItem(DRAFT)}catch{}onReview(h)}
 function parse(){
  if(looksLikeAssistantResult(text)){try{review(readAssistantHand(text))}catch(e){setIssue(e.message)}return;}
  const result=convertQuickNotes(text,options);
  if(result.hand)review(result.hand);else setIssue('快速縮寫轉換未能理解呢手。唔使改寫成指定格式，可以用「交畀 ChatGPT 理解」處理原文。');
 }
 function beginUnderstanding(){
  try{setRequest(understandingRequest(text,options));setStage('assistant');setIssue('');store({stage:'assistant'})}catch(e){setIssue(e.message)}
 }
 async function copyRequest(){
  try{const value=request||understandingRequest(text,options);setRequest(value);await navigator.clipboard.writeText(value);setCopyMessage('已複製。貼返原本同我整網站嗰個 ChatGPT 對話，我會幫你轉成重播連結。')}catch{setRequest(understandingRequest(text,options));setShowRequest(true);setCopyMessage('手機未能自動複製，請長按下面文字，全選後複製。')}
 }
 function openAnswer(){try{review(readAssistantHand(answer,{originalNotes:text}));}catch(e){setIssue(`整理結果未能開啟：${e.message} 可以將呢句貼返畀 ChatGPT 修正，唔使自己改資料。`)}}
 return <Modal title={stage==='assistant'?'用 ChatGPT 理解自由手記':'文字手記 → 重播'} onClose={onClose}>
 {stage==='assistant'?<section className="assistant-handoff">
  <p>返去原本同我整網站嗰個 ChatGPT 對話，直接貼你平時 mark 嘅 hand。我會理解後回你一條重播連結，撳開就睇得。</p>
  <p className="hint">有歧義先問嗰一點，唔使跟範例格式。你亦可以直接喺對話貼手牌，唔經此頁複製。</p>
  <div className="assistant-actions"><button className="primary" onClick={copyRequest}><Copy size={16}/> 複製手記同整理要求</button><a className="button" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> 開啟 ChatGPT</a></div>
  {copyMessage&&<p className="hint" role="status">{copyMessage}</p>}
  <p className="hint">此頁唔會自動傳送手記。你自行貼入 ChatGPT 先會交畀該服務；原文草稿保留喺呢個分頁。</p>
  <details open={showRequest} onToggle={e=>setShowRequest(e.currentTarget.open)}><summary>手動複製／查看整理要求</summary><textarea className="raw-input" aria-label="ChatGPT 手記整理要求" readOnly value={request||understandingRequest(text,options)} rows="7" onFocus={e=>e.target.select()}/></details>
  <details className="assistant-fallback"><summary>收到整理結果而唔係連結？貼返呢度開啟</summary><label className="field-label">貼返 ChatGPT 最後嘅整理結果<textarea className="raw-input" aria-label="ChatGPT 整理結果" value={answer} onChange={e=>{setAnswer(e.target.value);setIssue('')}} rows="6" placeholder="直接複製佢最後嘅 JSON 程式碼區塊；你唔使自己寫或修改。"/></label>
  {issue&&<div className="error" role="alert">{issue}</div>}
  <button className="primary full" disabled={!answer.trim()} onClick={openAnswer}>開啟整理後嘅重播 <ArrowRight size={16}/></button></details>
  <button className="subtle full" onClick={()=>{setStage('notes');setIssue('');store({stage:'notes'})}}>返回原手記</button>
 </section>:<>
  <p>自由手記可以交畀 ChatGPT 理解，唔使改格式。此網站未接內置 AI；下面嘅快速轉換只處理已支援縮寫。</p>
  <textarea className="raw-input notes-input" aria-label="文字手記" placeholder="照平時 mark hand 咁貼，中英夾雜、自己嘅縮寫、換行都得。亦可直接貼入 ChatGPT 已整理好嘅結果。" rows="9" value={text} onChange={e=>{setText(e.target.value);setIssue('');store({text:e.target.value})}}/>
  {issue&&<div className="error" role="alert">{issue}</div>}
  <button className="primary full notes-submit" disabled={!text.trim()||text.length>20000} onClick={beginUnderstanding}>交畀 ChatGPT 理解 <ArrowRight size={16}/></button>
  <button className="full notes-fast" disabled={!text.trim()||text.length>1000000} onClick={parse}>轉成重播</button>
  <p className="hint">上面交畀 ChatGPT 理解自由文字；「轉成重播」只係本機快速縮寫／已整理結果匯入。只用已完成 hand，預覽未會保存或分享。</p>
  <details className="notes-optional"><summary>快速轉換設定／範例</summary>
   <div className="form-grid notes-settings">
    <label>手記無寫幣別時<select aria-label="手記幣別" value={currency} onChange={e=>{setCurrency(e.target.value);setIssue('');store({currency:e.target.value})}}><option value="">籌碼（唔換算）</option>{['HKD','RMB','USD','EUR','BB'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>牌桌位置示意<select aria-label="手記桌型" value={maxSeats} onChange={e=>{setMax(e.target.value);setIssue('');store({maxSeats:e.target.value})}}><option value="">按已寫位置排列</option><option value="6">6-max</option><option value="9">9-max</option></select></label>
    <label>加注金額<select aria-label="加注金額解讀" value={raiseMode} onChange={e=>{setRaiseMode(e.target.value);setIssue('');store({raiseMode:e.target.value})}}><option value="to">加注至總額（預設）</option><option value="increment">本次額外投入</option></select></label>
   </div>
   <div className="notes-examples"><button onClick={()=>{setText(quickExample);setIssue('');store({text:quickExample})}}>簡短範例（虛構）</button><button onClick={()=>{setText(markedExample);setIssue('');store({text:markedExample})}}>3-way 全押範例（虛構）</button></div>
   <p className="hint">快速轉換係規則工具，唔會理解所有隨意寫法。自由文字請用上面嘅 ChatGPT 流程；唔使遷就呢啲範例。</p>
  </details>
 </>}
 </Modal>
}
