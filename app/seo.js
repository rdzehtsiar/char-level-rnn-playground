const FALLBACK_SITE_URL = 'http://localhost:3000'

function normalizeSiteUrl(value) {
  if (!value) return null

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`

  try {
    return new URL(withProtocol).origin
  } catch {
    return null
  }
}

export const siteConfig = {
  name: 'Orc Name Generator',
  description:
    'Generate unique male and female orc names for fantasy characters, roleplaying games, stories, and worldbuilding.',
  creator: 'Orc Name Generator',
  publisher: 'Orc Name Generator',
  keywords: [
    'orc name generator',
    'orc names',
    'fantasy name generator',
    'fantasy names',
    'male orc names',
    'female orc names',
    'rpg names',
    'roleplaying names',
    'character name generator',
    'worldbuilding names',
  ],
}

export const siteOrigin =
  normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
  normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
  normalizeSiteUrl(process.env.VERCEL_URL) ||
  FALLBACK_SITE_URL

export const siteUrl = new URL(siteOrigin)

export function absoluteUrl(path = '/') {
  return new URL(path, siteUrl).toString()
}
