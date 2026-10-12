import { assets, capitalFlows, financialEvents, type Asset, type CapitalFlow, type FinancialEvent, type Market } from './demo-data';

export type SubscriptionTier = 'free' | 'research' | 'professional';
export interface SubscriptionPlan { id: SubscriptionTier; name: string; monthlyPriceTwd: number; description: string; features: string[]; available: false; }
export const subscriptionPlans: SubscriptionPlan[] = [
  { id: 'free', name: '探索方案', monthlyPriceTwd: 0, description: '建立你的市場觀察習慣', features: ['三大市場示範篩選', '本機自選清單', '全球事件日曆'], available: false },
  { id: 'research', name: '研究方案', monthlyPriceTwd: 499, description: '為持續研究的投資人預留', features: ['進階篩選與提醒', '跨裝置自選同步', '資金研究報告'], available: false },
  { id: 'professional', name: '專業方案', monthlyPriceTwd: 1299, description: '為專業研究工作流程預留', features: ['研究方案所有功能', '資料匯出與團隊空間', '自訂研究儀表板'], available: false },
];
export interface TenantConfig { id: string; slug: string; displayName: string; locale: 'zh-TW'; timeZone: 'Asia/Taipei'; hostingModel: 'managed-rental' | 'license-sale'; branding: { accentColor: string; logoText: string }; subscriptionEnabled: boolean; dataMode: 'demo' | 'live'; }
export const demoTenant: TenantConfig = { id: 'demo', slug: 'market-lens', displayName: '觀潮 Tide Research', locale: 'zh-TW', timeZone: 'Asia/Taipei', hostingModel: 'managed-rental', branding: { accentColor: '#21836f', logoText: '觀潮' }, subscriptionEnabled: false, dataMode: 'demo' };
export interface Member { id: string; tenantId: string; email: string; tier: SubscriptionTier; }
export interface Watchlist { id: string; tenantId: string; memberId: string; name: string; assetIds: string[]; }
/** A server-side implementation can enforce tenant/member entitlements and normalize vendor data here. */
export interface MarketDataProvider { readonly mode: 'demo' | 'live'; getAssets(market?: Market): Promise<Asset[]>; getCapitalFlows(): Promise<CapitalFlow[]>; getEvents(): Promise<FinancialEvent[]>; }
export const demoMarketDataProvider: MarketDataProvider = { mode: 'demo', async getAssets(market) { return assets.filter((item) => !market || item.market === market); }, async getCapitalFlows() { return capitalFlows; }, async getEvents() { return financialEvents; } };
