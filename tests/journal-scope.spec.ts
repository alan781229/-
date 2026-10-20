import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('src/lib/journal.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
test('帳號本機紀錄分區，舊版需明確匯入且不刪除、不覆寫',async({page})=>{
 await page.route('**/journal-storage-fixture',route=>route.fulfill({contentType:'text/html',body:'<html><body>IndexedDB fixture</body></html>'}));await page.goto('/journal-storage-fixture');
 const result=await page.evaluate(async source=>{
 const journal=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
 const record={...journal.demoTrades()[0],id:'same-id',demo:false,symbol:'ETHUSDT'};
 await journal.persistTrade(record,'user-A');await journal.persistTrade({...record,symbol:'BTCUSDT'},'user-B');
 const a=await journal.readTrades('user-A'),b=await journal.readTrades('user-B'),guest=await journal.readTrades();
 await new Promise<void>((resolve,reject)=>{const q=indexedDB.open('tide-trading-journal',1);q.onupgradeneeded=()=>q.result.createObjectStore('trades',{keyPath:'id'});q.onsuccess=()=>{const db=q.result,tx=db.transaction('trades','readwrite');tx.objectStore('trades').put({...record,id:'legacy-old'});tx.oncomplete=()=>{db.close();resolve();};};q.onerror=()=>reject(q.error);});
 const before=await journal.readTrades('user-A'),legacy=await journal.readLegacyTrades();
 await journal.importLegacyTrades(legacy,'user-A');await journal.importLegacyTrades(legacy.map((r:object)=>({...r,symbol:'MODIFIED'})),'user-A');
 const after=await journal.readTrades('user-A'),other=await journal.readTrades('user-B');await journal.deleteTrade('same-id','user-A');
 return {a:a[0].symbol,b:b[0].symbol,guest:guest.length,before:before.length,after:after.map((r:{id:string;symbol:string})=>({id:r.id,symbol:r.symbol})),other:other.length,legacy:(await journal.readLegacyTrades()).length,remainingA:(await journal.readTrades('user-A')).length,remainingB:(await journal.readTrades('user-B')).length,names:[journal.journalDatabaseName('a/b'),journal.journalDatabaseName('a%2Fb')]};
 },code);
 expect(result).toMatchObject({a:'ETHUSDT',b:'BTCUSDT',guest:0,before:1,other:1,legacy:1,remainingA:1,remainingB:1});expect(result.after).toContainEqual({id:'legacy:legacy-old',symbol:'ETHUSDT'});expect(result.after).toHaveLength(2);expect(result.names[0]).not.toBe(result.names[1]);
});
