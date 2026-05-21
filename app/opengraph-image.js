import { ImageResponse } from 'next/og'
import { siteConfig } from './seo'

export const alt = siteConfig.name
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#090909',
          color: '#f6f1e7',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'center',
          padding: '72px',
          width: '100%',
        }}
      >
        <div
          style={{
            color: '#9ac36a',
            display: 'flex',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 3,
            marginBottom: 28,
            textTransform: 'uppercase',
          }}
        >
          Fantasy Name Tool
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1,
            textAlign: 'center',
          }}
        >
          Orc Name Generator
        </div>
        <div
          style={{
            color: '#c7c0b3',
            display: 'flex',
            fontSize: 34,
            lineHeight: 1.35,
            marginTop: 34,
            maxWidth: 900,
            textAlign: 'center',
          }}
        >
          Unique male and female orc names for RPGs, stories, and worldbuilding.
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
