import {useEffect,useState} from 'react';
import {LockKeyhole,ArrowRight,ShieldCheck} from 'lucide-react';
import App from './App';
import {api} from './api';

export default function AuthGate(){
 const [session,setSession]=useState(null),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function check(){setError('');try{setSession(await api('/session'))}catch{setError('未能連接工作台，請檢查網絡或確認服務已啟動。')}}
 useEffect(()=>{check();const expired=()=>{setSession({required:true,authenticated:false});setPassword('');setError('登入已過期，請重新登入。')};window.addEventListener('poker-session-expired',expired);return()=>window.removeEventListener('poker-session-expired',expired)},[]);
 async function login(e){e.preventDefault();setBusy(true);setError('');try{await api('/login','POST',{password});setPassword('');await check()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function logout(){try{await api('/logout','POST',{});setSession({required:true,authenticated:false});setPassword('')}catch{setError('登出失敗，請再試。')}}
 if(session?.authenticated)return <App onLogout={session.required?logout:null}/>;
 return <main className="login-page"><section className="login-panel"><div className="brand">POKER <em>/</em> <span>OS</span></div><div className="login-symbol"><LockKeyhole size={25}/></div><h1>私人復盤工作台</h1><p>你的手牌、筆記與教材，在同一個地方。<br/>支援 iPhone、iPad 及電腦瀏覽器。</p>{session?<form onSubmit={login}><label htmlFor="workspace-password">登入密碼</label><input id="workspace-password" type="password" autoComplete="current-password" autoCapitalize="none" spellCheck={false} value={password} onChange={e=>setPassword(e.target.value)} required placeholder="輸入私人工作台密碼"/><button className="primary full" disabled={busy||!password}>{busy?'登入中…':'登入工作台'}<ArrowRight size={17}/></button></form>:<div className="session-loading">{error?<button onClick={check}>重新連線</button>:'連接工作台中…'}</div>}{error&&<p className="error" role="alert">{error}</p>}<div className="login-footer"><ShieldCheck size={15}/><span>已完成手牌 · 私人研究 · 離線復盤</span></div></section></main>
}
