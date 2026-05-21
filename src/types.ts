export type NewsCategory =
  | 'fofoca'
  | 'polemica'
  | 'futebol'
  | 'influencers'
  | 'tv-musica'
  | 'bastidores'

export interface Article {
  id: string
  title: string
  description: string
  content: string
  source: string
  provider: 'Google Noticias' | 'GNews' | 'NewsAPI'
  url: string
  imageUrl: string
  publishedAt: string
  topic: string
  angle: string
}
