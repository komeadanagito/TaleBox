import { StoryProvider } from "./context/StoryContext";
import "./globals.css";

export const metadata = {
  title: "TaleBox - 沉浸式互动小说创作与阅读",
  description: "AI 互动小说阅读与创作工作区",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <StoryProvider>
          {children}
        </StoryProvider>
      </body>
    </html>
  );
}
