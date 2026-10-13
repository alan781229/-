export type OcrField = 'symbol'|'side'|'openedAt'|'closedAt'|'entry'|'exit'|'quantity'|'leverage'|'fees'|'funding';
export type OcrTrade = {fields:Partial<Record<OcrField,string>>; net?:string; roi?:string};
/** Extract only explicitly labeled screenshot values; never derive missing margin. */
export function parseTradeScreenshot(raw:string):OcrTrade {
 const text=raw.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g,'$1').replace(/，/g,',').replace(/[−–]/g,'-');
 const fields:OcrTrade['fields']={};
 const symbol=text.match(/\b([A-Z0-9]{2,20}USDT)\b/i);if(symbol)fields.symbol=symbol[1].toUpperCase();
 if(/(?:做空|空單|\bSHORT\b)/i.test(text))fields.side='short';else if(/(?:做多|\bLONG\b|USDT\s*[>›]?\s*多)/i.test(text))fields.side='long';
 const leverage=text.match(/\b(\d{1,3})\s*[xX倍]/);if(leverage)fields.leverage=leverage[1];
 function value(labels:string){const match=text.match(new RegExp(`(?:${labels})\\s*[:：]?\\s*([+-]?\\d[\\d,]*(?:\\.\\d+)?)`,'i'));return match?.[1].replace(/,/g,'');}
 function date(labels:string){const match=text.match(new RegExp(`(?:${labels})\\s*[:：]?\\s*(\\d{4}[-/]\\d{2}[-/]\\d{2})\\s+(\\d{2}:\\d{2}(?::\\d{2})?)`));return match?match[1].replace(/\//g,'-')+'T'+match[2]:undefined;}
 const mappings:[OcrField,string][]=[['entry','開倉均價|开仓均价|Entry price'],['exit','平倉均價|平仓均价|Exit price'],['quantity','已平倉量|已平仓量|最大持倉量|最大持仓量|Quantity'],['fees','交易費用|交易费用|Trading fee'],['funding','資金費用|资金费用|Funding fee']];
 for(const [key,labels] of mappings){const found=value(labels);if(found!==undefined)fields[key]=key==='fees'?String(Math.abs(Number(found))):found;}
 const opened=date('開倉時間|开仓时间|Opened');const closed=date('平倉時間|平仓时间|Closed');if(opened)fields.openedAt=opened;if(closed)fields.closedAt=closed;
 return {fields,net:value('倉位收益|仓位收益|Position PNL'),roi:value('收益率|ROI')};
}
export async function recognizeTradeImage(file:File,onProgress:(progress:number)=>void):Promise<string>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('截圖限 PNG、JPEG、WebP，最多 5 MB。');
 const {createWorker}=await import('tesseract.js');
 const worker=await createWorker('eng+chi_tra',1,{logger:message=>{if(message.status==='recognizing text')onProgress(message.progress);}});
 try {const result=await worker.recognize(file);return result.data.text;}finally{await worker.terminate();}
}
