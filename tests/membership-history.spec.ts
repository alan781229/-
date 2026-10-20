import {test,expect,type Page} from '@playwright/test';
async function navigate(page:Page,name:string){const button=page.locator('.sidebar nav').getByRole('button',{name,exact:true});if(!await button.isVisible())await page.getByRole('button',{name:'開啟選單',exact:true}).click();await button.click();}
async function account(page:Page,role:'free'|'paid'|'admin'){
 await page.route('**/api/account',route=>route.fulfill({json:{user:{id:'owner-test',email:'owner@example.test',role},permissions:role==='free'?['basic']:role==='paid'?['basic','scan','history']:['basic','scan','history','admin'],adminConfigured:true,paymentEnabled:false,journalStorage:'browser-local'}}));
 await page.route('**/api/scan/status',route=>route.fulfill({json:{progress:null,snapshot:null}}));
}
test('免費會員可用歷史示範但不能啟動真實掃描與歷史讀取',async({page})=>{
 await account(page,'free');let historyCalls=0;await page.route('**/api/history?**',route=>{historyCalls++;return route.fulfill({status:403,json:{error:'需要付費會員'}})});
 await page.goto('/');await expect(page.getByRole('button',{name:'掃描 / 繼續真實全市場',exact:true})).toBeDisabled();
 await navigate(page,'歷史回顧');await expect(page.locator('.history-mode')).toHaveText('合成示範行情');await expect(page.locator('.history-chart polyline')).toHaveCount(3);
 await page.getByRole('button',{name:'讀取真實歷史',exact:true}).click();await expect(page.locator('.history-error')).toContainText('付費會員');expect(historyCalls).toBe(0);
 await page.getByLabel('歷史開始日期',{exact:true}).fill('2022-02-01');await page.getByLabel('歷史結束日期',{exact:true}).fill('2022-03-31');await page.getByRole('button',{name:'套用示範',exact:true}).click();await expect(page.locator('.history-events article')).toHaveCount(2);
 await page.locator('.history-events article').first().getByRole('button').click();await expect(page.getByLabel('圖表對照日期',{exact:true})).toHaveValue('2022-02-24');
 await navigate(page,'會員中心');await expect(page.locator('.membership-identity')).toContainText('免費會員');await expect(page.locator('.membership-admin')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('管理員必須確認才能開通及取消會員付費權限',async({page})=>{
 await account(page,'admin');let role:'free'|'paid'='free';const changes:unknown[]=[];const member=()=>({id:'member-1',email:'member@example.test',role,createdAt:'2026-10-20T00:00:00Z',updatedAt:'2026-10-20T00:00:00Z'});
 await page.route('**/api/admin/members**',async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();changes.push(body);role=body.role;return route.fulfill({json:{member:member(),changed:true,changeId:'audit-test'}})}return route.fulfill({json:{members:[member()],cursor:null,hasMore:false}})});
 await page.goto('/');await navigate(page,'會員中心');await expect(page.locator('.membership-identity')).toContainText('管理員');
 const selector=page.getByLabel('調整 member@example.test 角色',{exact:true});await expect(selector).toHaveValue('free');await selector.selectOption('paid');await expect(page.locator('.membership-confirm')).toContainText('確認調整角色');expect(changes).toEqual([]);
 await page.getByRole('button',{name:'取消變更',exact:true}).click();expect(changes).toEqual([]);await selector.selectOption('paid');await page.getByRole('button',{name:'確認變更角色',exact:true}).click();await expect(selector).toHaveValue('paid');await expect(page.locator('.membership-success')).toContainText('付費會員');expect(changes).toEqual([{userId:'member-1',role:'paid'}]);
 await selector.selectOption('free');await page.getByRole('button',{name:'確認變更角色',exact:true}).click();await expect(selector).toHaveValue('free');expect(changes).toHaveLength(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('付費歷史疊圖以共同日期對齊並可定位事件與切換尺度',async({page})=>{
 await account(page,'paid');const dates=['2020-03-10','2020-03-11','2020-03-12','2020-03-13'];
 const series=['oil','btc','sp500'].map((id,n)=>({id,label:['WTI 原油','比特幣 BTC','標普 500'][n],currency:'USD',source:'HTTP contract fixture',points:dates.filter((_,i)=>!(n===1&&i===2)).map((date,i)=>({date,value:(n+1)*100+i*10,open:(n+1)*100+i*10-2,high:(n+1)*100+i*10+4,low:(n+1)*100+i*10-5}))}));
 let query='';await page.route('**/api/history?**',route=>{query=route.request().url();return route.fulfill({json:{series,events:[{id:'test-event',date:'2020-03-11',title:'測試金融事件',region:'全球',description:'明確標示為測試資料的事件',sourceUrl:'https://www.who.int/'}],asOf:'2026-10-20T00:00:00Z'}})});
 await page.goto('/');await navigate(page,'歷史回顧');await page.getByLabel('歷史資料來源',{exact:true}).selectOption('yahoo');await page.getByLabel('歷史開始日期',{exact:true}).fill('2020-03-10');await page.getByLabel('歷史結束日期',{exact:true}).fill('2020-03-13');await page.getByRole('button',{name:'讀取真實歷史',exact:true}).click();
 await expect(page.locator('.history-mode')).toHaveText('真實歷史行情');expect(new URL(query).searchParams.get('assets')).toBe('oil,btc,sp500');expect(new URL(query).searchParams.get('provider')).toBe('yahoo');await expect(page.locator('.history-chart polyline')).toHaveCount(3);await expect(page.locator('.history-chart-heading').first()).toContainText('3 個共同交易日');await expect(page.locator('.history-footnote').first()).toContainText('排除 1 個非共同日期');
 await page.locator('.history-events article').getByRole('button').click();await expect(page.getByLabel('圖表對照日期',{exact:true})).toHaveValue('2020-03-11');await expect(page.locator('.history-readout')).toContainText('共同交易日 2020-03-11');await expect(page.locator('.history-events article')).toHaveClass('is-active');
 await page.locator('.history-controls select').selectOption('percent');await expect(page.locator('.history-chart-heading').first()).toContainText('相對起點變動');await page.getByLabel('圖表對照日期',{exact:true}).fill('2020-03-12');await expect(page.locator('.history-readout')).toContainText('共同交易日 2020-03-11');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('FRED 基準收盤疊圖不虛構 OHLC 並與期貨來源明確分開',async({page})=>{
 await account(page,'paid');let query='';await page.route('**/api/history?**',route=>{query=route.request().url();return route.fulfill({json:{provider:'fred',series:['oil','btc','sp500'].map((id,n)=>({id,label:id==='oil'?'WTI 原油現貨':'FRED '+id,currency:'USD',source:'FRED fixture',note:'僅提供每日觀測值，無 OHLC',sourceUrl:'https://fred.stlouisfed.org/',points:[{date:'2020-04-20',value:100*(n+1)},{date:'2020-04-21',value:110*(n+1)}]}))}})});
 await page.goto('/');await navigate(page,'歷史回顧');await expect(page.getByLabel('歷史資料來源',{exact:true})).toHaveValue('fred');await expect(page.getByLabel('黃金',{exact:true})).toBeDisabled();await page.getByRole('button',{name:'讀取真實歷史',exact:true}).click();
 await expect(page.locator('.history-mode')).toHaveText('真實歷史行情');expect(new URL(query).searchParams.get('provider')).toBe('fred');await expect(page.locator('.history-chart rect')).toHaveCount(0);await expect(page.locator('.history-chart polyline')).toHaveCount(3);await expect(page.locator('.history-footnote').first()).toContainText('未提供完整 OHLC');await expect(page.locator('.history-readout')).toContainText('WTI 原油現貨');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
