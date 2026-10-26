import {useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {Modal} from './HandEditor';
import {markedExample} from './notes.js';
import {convertQuickNotes,quickExample} from './quickNotes.js';

export default function NotesImport({onClose,onReview}){
 const [text,setText]=useState(''),[currency,setCurrency]=useState(''),[maxSeats,setMax]=useState(''),[raiseMode,setRaiseMode]=useState('to'),[issue,setIssue]=useState('');
 function parse(){
  const result=convertQuickNotes(text,{currency,maxSeats:Number(maxSeats)||undefined,raiseMode});
  if(result.hand)onReview(result.hand);else setIssue(result.issues[0]);
 }
 return <Modal title="貼上手記，即刻重播" onClose={onClose}>
  <p>照平時 mark hand 咁貼就得，唔使先整理成表格。</p>
  <textarea className="raw-input notes-input" aria-label="文字手記" placeholder={quickExample} rows="10" value={text} onChange={e=>{setText(e.target.value);setIssue('')}}/>
  <p className="hint">無寫花色／Stack 會保留未知；無寫幣別就顯示籌碼。未記下注唔會自動補上，重建假設會標示。</p>
  {issue&&<div className="error" role="alert">{issue}</div>}
  <button className="primary full notes-submit" disabled={!text.trim()||text.length>20000} onClick={parse}>轉成重播 <ArrowRight size={16}/></button>
  <p className="hint">只貼已完成嘅 hand。按上面即開預覽，未會保存或分享。</p>
  <details className="notes-optional"><summary>選填設定／睇範例</summary>
   <div className="form-grid notes-settings">
    <label>手記無寫幣別時<select aria-label="手記幣別" value={currency} onChange={e=>{setCurrency(e.target.value);setIssue('')}}><option value="">籌碼（唔換算）</option>{['HKD','RMB','USD','EUR','BB'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>牌桌位置示意<select aria-label="手記桌型" value={maxSeats} onChange={e=>{setMax(e.target.value);setIssue('')}}><option value="">按已寫位置排列</option><option value="6">6-max</option><option value="9">9-max</option></select></label>
    <label>加注金額<select aria-label="加注金額解讀" value={raiseMode} onChange={e=>{setRaiseMode(e.target.value);setIssue('')}}><option value="to">加注至總額（預設）</option><option value="increment">本次額外投入</option></select></label>
   </div>
   <div className="notes-examples"><button onClick={()=>{setText(quickExample);setIssue('')}}>簡短範例（虛構）</button><button onClick={()=>{setText(markedExample);setIssue('')}}>3-way 全押範例（虛構）</button></div>
   <p className="hint">支援 c / x / f / r / b / jam、k 金額、直接寫 277r 再換行記 Turn／River。第一次寫 Hero SB 或 Hero BTN，之後用 Hero 就得。未識嘅寫法會提示嗰一段；目前係本機縮寫轉換，唔係通用 AI。</p>
  </details>
 </Modal>
}
