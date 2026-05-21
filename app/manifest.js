import { siteConfig } from './seo'

export default function manifest() {
  return {
    name: siteConfig.name,
    short_name: 'Orc Names',
    description: siteConfig.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#090909',
    theme_color: '#090909',
    categories: ['games', 'entertainment', 'utilities'],
  }
}
