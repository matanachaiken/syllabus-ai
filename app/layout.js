import './globals.css'

export const metadata = {
  title: 'SyllabusAI',
  description: 'Upload a syllabus and get a full breakdown',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}