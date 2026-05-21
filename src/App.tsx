import { startTransition, useEffect, useMemo, useState } from 'react'
import './App.css'
import type { Article, NewsCategory } from './types'

const CATEGORIES: Array<{
  id: NewsCategory
  label: string
  description: string
}> = [
  {
    id: 'fofoca',
    label: 'Fofoca',
    description: 'Relacionamentos, exposed e climao dos famosos.',
  },
  {
    id: 'polemica',
    label: 'Polemica',
    description: 'Tretas, pronunciamentos e confusoes publicas.',
  },
  {
    id: 'futebol',
    label: 'Futebol',
    description: 'Craques, bastidores do esporte e polemicas do campo.',
  },
  {
    id: 'influencers',
    label: 'Influencers',
    description: 'TikTok, Instagram, creators e nomes quentes da internet.',
  },
  {
    id: 'tv-musica',
    label: 'TV & Musica',
    description: 'Reality show, novela, cantor, atriz e lancamentos.',
  },
  {
    id: 'bastidores',
    label: 'Bastidores',
    description: 'Segredos, backstage e movimentos por tras das cameras.',
  },
]

const PROVIDER_SECTIONS: Array<{
  id: Article['provider']
  label: string
  subtitle: string
}> = [
  {
    id: 'Google Noticias',
    label: 'Google Noticias',
    subtitle: 'Leitura ampla de tendencias via feed do Google.',
  },
  {
    id: 'GNews',
    label: 'GNews API',
    subtitle: 'Busca estruturada para achar pauta quente rapido.',
  },
  {
    id: 'NewsAPI',
    label: 'NewsAPI',
    subtitle: 'Headlines e everything separados por fonte.',
  },
]

const EMPTY_MESSAGE =
  'Escolha uma categoria para puxar as noticias mais quentes e gerar legendas em segundos.'

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()

    if (text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<html')) {
      throw new Error(
        'A rota /api respondeu HTML em vez de JSON. Rode o projeto com `npm run dev:vercel` para subir o frontend junto com as funcoes da Vercel.',
      )
    }

    throw new Error('A rota /api respondeu em um formato inesperado.')
  }

  return response.json() as Promise<T>
}

function App() {
  const [category, setCategory] = useState<NewsCategory>('fofoca')
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [caption, setCaption] = useState('')
  const [loadingNews, setLoadingNews] = useState(false)
  const [loadingCaption, setLoadingCaption] = useState(false)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadNews() {
      setLoadingNews(true)
      setError('')
      setCaption('')

      try {
        const response = await fetch(`/api/news?category=${category}`)
        const payload = await readApiJson<{
          articles?: Article[]
          warnings?: string[]
          error?: string
        }>(response)

        if (!response.ok) {
          throw new Error(payload.error ?? 'Nao foi possivel carregar as noticias.')
        }

        const nextArticles = payload.articles ?? []

        if (cancelled) {
          return
        }

        startTransition(() => {
          setArticles(nextArticles)
          setSelectedId(nextArticles[0]?.id ?? '')
          setWarnings(payload.warnings ?? [])
        })
      } catch (requestError) {
        if (cancelled) {
          return
        }

        setArticles([])
        setSelectedId('')
        setWarnings([])
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Erro inesperado ao consultar as APIs.',
        )
      } finally {
        if (!cancelled) {
          setLoadingNews(false)
        }
      }
    }

    void loadNews()

    return () => {
      cancelled = true
    }
  }, [category, reloadKey])

  const filteredArticles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return articles
    }

    return articles.filter((article) =>
      [article.title, article.description, article.source, article.topic, article.provider]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [articles, search])

  const groupedArticles = useMemo(
    () =>
      PROVIDER_SECTIONS.map((section) => ({
        ...section,
        articles: filteredArticles.filter((article) => article.provider === section.id),
      })),
    [filteredArticles],
  )

  const selectedArticle =
    filteredArticles.find((article) => article.id === selectedId) ??
    filteredArticles[0] ??
    null

  async function handleGenerateCaption() {
    if (!selectedArticle) {
      return
    }

    setLoadingCaption(true)
    setError('')
    setCopyFeedback('')

    try {
      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article: selectedArticle,
        }),
      })

      const payload = await readApiJson<{
        caption?: string
        error?: string
      }>(response)

      if (!response.ok) {
        throw new Error(payload.error ?? 'Nao foi possivel gerar a legenda.')
      }

      setCaption(payload.caption ?? '')
    } catch (requestError) {
      setCaption('')
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Erro inesperado ao gerar a legenda.',
      )
    } finally {
      setLoadingCaption(false)
    }
  }

  async function handleCopyCaption() {
    if (!caption) {
      return
    }

    try {
      await navigator.clipboard.writeText(caption)
      setCopyFeedback('Legenda copiada.')
    } catch {
      setCopyFeedback('Nao foi possivel copiar automaticamente.')
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Studio de posts virais</span>
          <h1>Radar Pop</h1>
          <p className="hero-text">
            Agora voce navega pelas categorias no topo e compara as pautas por
            fonte lado a lado: Google Noticias, GNews e NewsAPI.
          </p>
        </div>

        <div className="hero-card">
          <p className="hero-kicker">Fluxo</p>
          <ol>
            <li>Troque a categoria no menu superior.</li>
            <li>Compare as manchetes fonte por fonte nas tres colunas.</li>
            <li>Escolha a melhor pauta e gere a legenda pronta para postar.</li>
          </ol>
        </div>
      </section>

      <section className="workspace">
        <div className="top-bar">
          <div className="panel-heading">
            <div>
              <span className="section-tag">Categorias</span>
              <h2>Escolha o territorio da pauta</h2>
            </div>
            <button
              type="button"
              className="refresh-button"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Atualizar
            </button>
          </div>

          <div className="category-menu">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === category ? 'category active' : 'category'}
                onClick={() => setCategory(item.id)}
              >
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>

          <label className="search-box">
            <span>Filtrar pauta</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex.: Neymar, BBB, treta, cantora..."
            />
          </label>

          {error ? <p className="feedback error">{error}</p> : null}

          {warnings.length > 0 ? (
            <div className="warnings-panel">
              {warnings.map((warning) => (
                <p key={warning} className="feedback">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          <div className="news-columns">
            {groupedArticles.map((section) => (
              <div key={section.id} className="news-panel">
                <div className="panel-heading compact">
                  <div>
                    <span className="section-tag">Noticias</span>
                    <h2>{section.label}</h2>
                    <p className="column-subtitle">{section.subtitle}</p>
                  </div>
                </div>

                {!loadingNews && section.articles.length === 0 ? (
                  <p className="feedback">Nenhuma pauta dessa fonte no filtro atual.</p>
                ) : null}

                <div className="article-list">
                  {section.articles.map((article) => (
                    <button
                      key={article.id}
                      type="button"
                      className={
                        article.id === selectedArticle?.id
                          ? 'article-card active'
                          : 'article-card'
                      }
                      onClick={() => {
                        setSelectedId(article.id)
                        setCaption('')
                        setCopyFeedback('')
                      }}
                    >
                      <span className="source-line">
                        <span>{article.source}</span>
                        <span>{new Date(article.publishedAt).toLocaleDateString('pt-BR')}</span>
                      </span>
                      <strong>{article.title}</strong>
                      <p>{article.description || 'Sem descricao resumida na fonte.'}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {!loadingNews && filteredArticles.length === 0 ? (
            <p className="feedback">{EMPTY_MESSAGE}</p>
          ) : null}
        </div>

        <section className="content">
          <div className="preview-panel">
            <div className="panel-heading">
              <div>
                <span className="section-tag">Pauta selecionada</span>
                <h2>{selectedArticle?.topic ?? 'Nenhuma pauta selecionada'}</h2>
              </div>
            </div>

            {selectedArticle ? (
              <>
                <div className="headline-block">
                  <div className="headline-copy">
                    <span className="meta-pill">
                      {selectedArticle.provider} |{' '}
                      {new Date(selectedArticle.publishedAt).toLocaleString('pt-BR')}
                    </span>
                    <h3>{selectedArticle.title}</h3>
                    <p>{selectedArticle.description || selectedArticle.content}</p>
                  </div>

                  {selectedArticle.imageUrl ? (
                    <img
                      className="headline-image"
                      src={selectedArticle.imageUrl}
                      alt={selectedArticle.title}
                    />
                  ) : null}
                </div>

                <div className="article-meta">
                  <div>
                    <span className="meta-label">Fonte</span>
                    <a href={selectedArticle.url} target="_blank" rel="noreferrer">
                      Abrir materia original
                    </a>
                  </div>
                  <div>
                    <span className="meta-label">Sugestao de gancho</span>
                    <p>{selectedArticle.angle}</p>
                  </div>
                </div>

                <div className="caption-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-tag">Legenda com IA</span>
                      <h2>Texto pronto para Instagram</h2>
                    </div>
                    <div className="action-row">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleGenerateCaption()}
                        disabled={loadingCaption}
                      >
                        {loadingCaption ? 'Gerando...' : 'Gerar descricao'}
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void handleCopyCaption()}
                        disabled={!caption}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="A legenda gerada pela IA vai aparecer aqui."
                  />

                  {copyFeedback ? <p className="feedback success">{copyFeedback}</p> : null}
                </div>
              </>
            ) : (
              <p className="feedback">{EMPTY_MESSAGE}</p>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
