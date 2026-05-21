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

const EMPTY_MESSAGE =
  'Escolha uma categoria para puxar as noticias mais quentes e gerar legendas em segundos.'

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

  useEffect(() => {
    let cancelled = false

    async function loadNews() {
      setLoadingNews(true)
      setError('')
      setCaption('')

      try {
        const response = await fetch(`/api/news?category=${category}`)
        const payload = (await response.json()) as {
          articles?: Article[]
          error?: string
        }

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
        })
      } catch (requestError) {
        if (cancelled) {
          return
        }

        setArticles([])
        setSelectedId('')
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
      [article.title, article.description, article.source, article.topic]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [articles, search])

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

      const payload = (await response.json()) as {
        caption?: string
        error?: string
      }

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
            Busque noticias quentes em fofoca, polemica, futebol, influencers,
            TV & musica e bastidores. Escolha uma pauta e gere uma legenda
            pronta para Instagram no estilo de perfis que vivem de viral.
          </p>
        </div>

        <div className="hero-card">
          <p className="hero-kicker">Fluxo</p>
          <ol>
            <li>Seleciona o nicho que voce quer atacar hoje.</li>
            <li>Escolhe a noticia mais forte entre GNews e NewsAPI.</li>
            <li>Gera uma legenda com CTA fixa para publicar rapido.</li>
          </ol>
        </div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <div className="panel-heading">
            <div>
              <span className="section-tag">Categorias</span>
              <h2>Fontes quentes</h2>
            </div>
            <button
              type="button"
              className="refresh-button"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Atualizar
            </button>
          </div>

          <div className="category-grid">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === category ? 'category active' : 'category'}
                onClick={() => setCategory(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
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

          <div className="news-panel">
            <div className="panel-heading compact">
              <div>
                <span className="section-tag">Noticias</span>
                <h2>{loadingNews ? 'Buscando...' : `${filteredArticles.length} pautas`}</h2>
              </div>
            </div>

            {error ? <p className="feedback error">{error}</p> : null}

            {!loadingNews && filteredArticles.length === 0 ? (
              <p className="feedback">{EMPTY_MESSAGE}</p>
            ) : null}

            <div className="article-list">
              {filteredArticles.map((article) => (
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
                    <span>{article.provider}</span>
                  </span>
                  <strong>{article.title}</strong>
                  <p>{article.description || 'Sem descricao resumida na fonte.'}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>

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
                      <span className="section-tag">Legenda com Gemini</span>
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
                    placeholder="A legenda gerada pela Gemini vai aparecer aqui."
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
