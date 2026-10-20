'use client';
import {useCallback,useEffect,useState} from 'react';

export type MemberRole='admin'|'paid'|'free';
export type AccountUser={id:string;email:string;role:MemberRole};
export type Account={user:AccountUser;permissions:string[];adminConfigured:boolean;paymentEnabled:false;journalStorage:string;signInPath?:string;signOutPath?:string};
export const memberRoleLabels:Record<MemberRole,string>={admin:'管理員',paid:'付費會員',free:'免費會員'};
export type AccountState={account:Account|null;loading:boolean;error:string;reload:()=>Promise<void>};
export function useAccount():AccountState {
 const [account,setAccount]=useState<Account|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{setLoading(true);setError('');try{const response=await fetch('/api/account',{credentials:'same-origin',cache:'no-store'});const payload=await response.json();if(!response.ok)throw Error(payload.error||`會員服務 HTTP ${response.status}`);if(!payload.user||!['admin','paid','free'].includes(payload.user.role)||typeof payload.user.id!=='string')throw Error('會員服務回應格式無效。');setAccount(payload);}catch(e){setAccount(null);setError(e instanceof Error?e.message:'無法取得會員權限。');}finally{setLoading(false);}},[]);
 useEffect(()=>{void reload();},[reload]);
 return {account,loading,error,reload};
}
