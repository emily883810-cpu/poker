import {useEffect,useState,lazy,Suspense} from 'react';
const CoachApp=lazy(()=>import('./CoachApp'));
const AuthGate=lazy(()=>import('./AuthGate'));
export default function Root(){const [hash,setHash]=useState(location.hash);useEffect(()=>{const changed=()=>setHash(location.hash);window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed)},[]);return <Suspense fallback={<div className="empty">讀取工作台中…</div>}>{import.meta.env.VITE_COACH_ONLY==='true'||hash.startsWith('#review=')?<CoachApp fragment={hash}/>:<AuthGate/>}</Suspense>}
