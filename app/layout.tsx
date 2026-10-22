import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'サイゼをつくろう — 2D配置・3Dウォーク', description: 'テーブルや椅子を2Dで配置して、自分だけのサイゼリヤ風の店内を作ろう。完成した店内は3Dで歩いて撮影できます。非公式ファンメイド。' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="ja"><body>{children}</body></html>}
