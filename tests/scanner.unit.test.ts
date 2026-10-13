import {test,expect} from '@playwright/test';
import {calculateIndicators,defaultRules,evaluateCandles,type Candle} from '../src/lib/scanner';
const fixture=(direction=1):Candle[]=>Array.from({length:300},(_,i)=>({time:i*900000,close:direction===1?100+i:500-i,volume:i===299?150:100}));
test('SMA, EMA seeded average and previous-bar volume denominator',()=>{const i=calculateIndicators(fixture());expect(i.ma20).toBe(389.5);expect(i.ma60).toBe(369.5);expect(i.ma120).toBe(339.5);expect(i.ema20).toBeCloseTo(389.5,8);expect(i.ema200).toBeCloseTo(299.5,8);expect(i.volumeRatio).toBe(1.5);expect(i.previous.ma20).toBe(388.5);});
test('strict long and short alignment, direction and volume filters',()=>{expect(evaluateCandles('BTCUSDT',fixture(),defaultRules)?.side).toBe('long');expect(evaluateCandles('ETHUSDT',fixture(-1),defaultRules)?.side).toBe('short');expect(evaluateCandles('BTCUSDT',fixture(),{...defaultRules,direction:'short'})).toBeNull();expect(evaluateCandles('BTCUSDT',fixture(),{...defaultRules,volumeRatio:2})).toBeNull();expect(evaluateCandles('BTCUSDT',fixture(),{...defaultRules,ma:false,ema:false})).toBeNull();});
test('insufficient history rejected and pullback differs from trend',()=>{expect(()=>calculateIndicators(fixture().slice(0,249))).toThrow('250');expect(evaluateCandles('BTCUSDT',fixture(),{...defaultRules,preset:'trend'})).not.toBeNull();expect(evaluateCandles('BTCUSDT',fixture(),{...defaultRules,preset:'pullback'})).toBeNull();});

test('technical conditions are evaluated from candles and selected criteria require all matches',async()=>{
 const {evaluateTechnicalConditions}=await import('../src/lib/scanner');
 const candles=fixture();expect(evaluateTechnicalConditions(candles,'long')).toContain('ma');expect(evaluateTechnicalConditions(candles,'long')).toContain('volume');expect(evaluateTechnicalConditions(candles,'short')).not.toContain('ma');
 expect(evaluateCandles('BTCUSDT',candles,{...defaultRules,conditions:['ma','volume']})).not.toBeNull();
 expect(evaluateCandles('BTCUSDT',candles,{...defaultRules,conditions:['engulfing']})).toBeNull();
 const modified=candles.map(c=>({...c,open:c.close-.5,high:c.close+1,low:c.close-1}));modified[298]={...modified[298],open:399,close:398};modified[299]={...modified[299],open:397,close:400};expect(evaluateTechnicalConditions(modified,'long')).toContain('engulfing');
});
test('scores rank each direction independently and retain only five with stable ties',async()=>{
 const {rankCandidates}=await import('../src/lib/scanner');const result=evaluateCandles('BASE',fixture(),defaultRules)!;
 const results=Array.from({length:12},(_,n)=>({...result,symbol:`S${String(n).padStart(2,'0')}`,side:n<6?'long' as const:'short' as const,score:n}));
 expect(rankCandidates(results,'long').map(r=>r.score)).toEqual([5,4,3,2,1]);expect(rankCandidates(results,'short').map(r=>r.score)).toEqual([11,10,9,8,7]);expect(rankCandidates(results,'long')[0].score).toBeLessThanOrEqual(100);
});
test('old snapshots without previous indicator values receive finite scores',async()=>{const {scoreCandidate,rankCandidates}=await import('../src/lib/scanner');const result=evaluateCandles('OLD',fixture(),defaultRules)!;delete result.score;result.indicators.previous={};expect(Number.isFinite(scoreCandidate(result.indicators,'long'))).toBe(true);expect(Number.isFinite(rankCandidates([result],'long')[0].score)).toBe(true);});
