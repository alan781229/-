// Actual WASM OCR smoke test, not mocked recognition. Public language files use curl's session proxy.
import { chromium } from 'playwright-core';
import {createWorker} from 'tesseract.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ts from 'typescript';
const dir=join(tmpdir(),'tide-ocr-verification');await mkdir(dir,{recursive:true});
for(const lang of ['eng','chi_tra'])execFileSync('curl',['-fsSL',`https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,'-o',join(dir,lang+'.traineddata.gz')],{stdio:'inherit'});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{const page=await browser.newPage({viewport:{width:1400,height:400}});await page.setContent(`<body style='background:#101010;color:white;font:24px "Noto Sans CJK TC",Arial;padding:25px'><b>ETHUSDT 多 100X</b><div style='display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:25px'><div>開倉時間 2026-10-12 12:49:00</div><div>開倉均價 2,560.45 USDT</div><div>平倉時間 2026-10-12 13:11:22</div><div>平倉均價 2,566.99 USDT</div><div>已平倉量 7.680 ETH</div><div>交易費用 -10.63878912 USDT</div><div>資金費用 0.00000000 USDT</div><div>倉位收益 +39.58841088 USDT</div><div>收益率 +20.13%</div></div></body>`);await page.screenshot({path:join(dir,'trade.png')});}finally{await browser.close();}
const worker=await createWorker('eng+chi_tra',1,{langPath:dir,cachePath:dir});
try{const {data}=await worker.recognize(join(dir,'trade.png'));await writeFile(join(dir,'recognized.txt'),data.text);const source=await readFile('src/lib/trade-ocr.ts','utf8');const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const {parseTradeScreenshot}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));const result=parseTradeScreenshot(data.text);for(const [key,value]of Object.entries({symbol:'ETHUSDT',leverage:'100',entry:'2560.45',exit:'2566.99',quantity:'7.680',fees:'10.63878912',funding:'0.00000000',closedAt:'2026-10-12T13:11:22'})){if(result.fields[key]!==value)throw Error(`OCR verification failed: ${key}: ${result.fields[key]}`);}console.log(JSON.stringify({engine:'tesseract.js eng+chi_tra',fields:result.fields,net:result.net,roi:result.roi,evidence:dir},null,2));}finally{await worker.terminate();}
