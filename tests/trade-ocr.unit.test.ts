import {test,expect} from '@playwright/test';
import {parseTradeScreenshot} from '../src/lib/trade-ocr';
test('交易截圖辨識欄位保留秒、費用支出轉正且不推算保證金',()=>{
 const result=parseTradeScreenshot(`ETHUSDT > 多 全倉-分倉 100X
開倉時間 2026-10-12 12:49:00
平倉時間 2026-10-12 13:11:22
開倉均價 2,560.45 USDT
平倉均價 2,566.99 USDT
最大持倉量 7.680 ETH
已平倉量 7.680 ETH
倉位收益 +39.58841088 USDT
收益率 +20.13%
交易費用 -10.63878912 USDT
資金費用 0.00000000 USDT`);
 expect(result.fields).toEqual({symbol:'ETHUSDT',side:'long',leverage:'100',openedAt:'2026-10-12T12:49:00',closedAt:'2026-10-12T13:11:22',entry:'2560.45',exit:'2566.99',quantity:'7.680',fees:'10.63878912',funding:'0.00000000'});expect(result.net).toBe('+39.58841088');expect(result.roi).toBe('+20.13');expect(result.fields).not.toHaveProperty('principal');
});
test('缺漏或無法辨識內容不填入虛構數據',()=>{expect(parseTradeScreenshot('unreadable screenshot').fields).toEqual({});expect(parseTradeScreenshot('BTCUSDT SHORT 20x Funding fee -1.25').fields).toEqual({symbol:'BTCUSDT',side:'short',leverage:'20',funding:'-1.25'});});

test('OCR常見中文字間空白與同列欄位可抽取',()=>{const r=parseTradeScreenshot('平 倉 時 間 2026-10-12 13:11:22 平 倉 均 價 2,566.99 USDT\n已 平 倉 量 7.680 ETH 交易 費用 -10.63878912 USDT');expect(r.fields.closedAt).toBe('2026-10-12T13:11:22');expect(r.fields.exit).toBe('2566.99');expect(r.fields.quantity).toBe('7.680');expect(r.fields.fees).toBe('10.63878912');expect(r.fields.side).toBeUndefined();});
