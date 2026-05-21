import './globals.css'

export const metadata = {
  title: 'Name Generator',
  description: 'Client-side character-level name generator'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
