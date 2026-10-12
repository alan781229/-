import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'觀潮 Tide Research｜全球金融研究',description:'跨市場篩選、自選清單、資金觀察與全球事件日曆。所有行情皆為示範資料。'};
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) { return <html lang="zh-Hant"><body>{children}</body></html> }
