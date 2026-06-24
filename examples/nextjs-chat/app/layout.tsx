export const metadata = { title: "Bismite — chat example" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject
    // attributes like cz-shortcut-listen on <body> before React hydrates,
    // which is harmless but trips the hydration mismatch warning.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "40px auto", padding: 16 }}>
        {children}
      </body>
    </html>
  );
}
