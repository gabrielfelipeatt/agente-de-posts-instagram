const CATEGORY_CONFIG = {
  fofoca: {
    topic: 'Fofoca',
    angle: 'Procure casal, exposed, separacao e frase que puxe curiosidade.',
    query:
      '(famosos OR celebridades OR fofoca OR namoro OR separacao OR traição OR traicao)',
    newsApiCategory: 'entertainment',
  },
  polemica: {
    topic: 'Polemica',
    angle: 'Priorize treta, pronunciamento, climao e alguem se defendendo.',
    query:
      '(polêmica OR polemica OR treta OR discussão OR discussao OR exposed OR pronunciamento)',
    newsApiCategory: 'entertainment',
  },
  futebol: {
    topic: 'Futebol',
    angle: 'Busque gancho de bastidor, declaracao forte, crise ou estrela do time.',
    query:
      '(futebol OR jogador OR campeonato OR tecnico OR neymar OR flamengo OR selecao)',
    newsApiCategory: 'sports',
  },
  influencers: {
    topic: 'Influencers',
    angle: 'Encontre creator em alta, cancelamento, namoro ou numero impressionante.',
    query:
      '(influencer OR criador OR creator OR tiktok OR instagram OR youtuber OR streamer)',
    newsApiCategory: 'entertainment',
  },
  'tv-musica': {
    topic: 'TV & Musica',
    angle: 'Puxe reality, novela, artista, hit, show, turne ou participacao surpresa.',
    query:
      '(tv OR música OR musica OR novela OR cantor OR cantora OR reality show OR serie)',
    newsApiCategory: 'entertainment',
  },
  bastidores: {
    topic: 'Bastidores',
    angle: 'Destaque segredo, backstage, fonte interna ou algo que vazou.',
    query:
      '(bastidores OR backstage OR vazou OR segredo OR producao OR camarim OR reality)',
    newsApiCategory: 'entertainment',
  },
}

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body)
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeArticle(article, provider, topic, angle) {
  const title = normalizeText(article.title)
  const url = normalizeText(article.url)

  if (!title || !url) {
    return null
  }

  return {
    id: Buffer.from(`${provider}:${url}`).toString('base64'),
    title,
    description: normalizeText(article.description),
    content: normalizeText(article.content),
    source: normalizeText(article.source?.name || article.source) || provider,
    provider,
    url,
    imageUrl: normalizeText(article.image || article.urlToImage),
    publishedAt: normalizeText(article.publishedAt) || new Date().toISOString(),
    topic,
    angle,
  }
}

async function readJson(response, fallbackError) {
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || fallbackError)
  }

  return response.json()
}

async function fetchGNews(query, apiKey) {
  const url = new URL('https://gnews.io/api/v4/search')
  url.searchParams.set('q', query)
  url.searchParams.set('lang', 'pt')
  url.searchParams.set('country', 'br')
  url.searchParams.set('max', '10')
  url.searchParams.set('sortby', 'publishedAt')
  url.searchParams.set('apikey', apiKey)

  const response = await fetch(url)
  const data = await readJson(response, 'Falha ao consultar o GNews.')
  return Array.isArray(data.articles) ? data.articles : []
}

async function fetchNewsApi(query, category, apiKey) {
  const topHeadlinesUrl = new URL('https://newsapi.org/v2/top-headlines')
  topHeadlinesUrl.searchParams.set('country', 'br')
  topHeadlinesUrl.searchParams.set('pageSize', '10')
  topHeadlinesUrl.searchParams.set('category', category)
  topHeadlinesUrl.searchParams.set('q', query)

  const everythingUrl = new URL('https://newsapi.org/v2/everything')
  everythingUrl.searchParams.set('language', 'pt')
  everythingUrl.searchParams.set('pageSize', '10')
  everythingUrl.searchParams.set('sortBy', 'publishedAt')
  everythingUrl.searchParams.set('q', query)

  const [topHeadlinesResponse, everythingResponse] = await Promise.all([
    fetch(topHeadlinesUrl, {
      headers: {
        'X-Api-Key': apiKey,
      },
    }),
    fetch(everythingUrl, {
      headers: {
        'X-Api-Key': apiKey,
      },
    }),
  ])

  const [topHeadlinesData, everythingData] = await Promise.all([
    readJson(topHeadlinesResponse, 'Falha ao consultar o NewsAPI/top-headlines.'),
    readJson(everythingResponse, 'Falha ao consultar o NewsAPI/everything.'),
  ])

  return [
    ...(Array.isArray(topHeadlinesData.articles) ? topHeadlinesData.articles : []),
    ...(Array.isArray(everythingData.articles) ? everythingData.articles : []),
  ]
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Metodo nao permitido.' })
  }

  const category = request.query.category
  const config = CATEGORY_CONFIG[category]

  if (!config) {
    return sendJson(response, 400, { error: 'Categoria invalida.' })
  }

  const gnewsApiKey = process.env.GNEWS_API_KEY
  const newsApiKey = process.env.NEWS_API_KEY

  if (!gnewsApiKey || !newsApiKey) {
    return sendJson(response, 500, {
      error: 'Defina GNEWS_API_KEY e NEWS_API_KEY nas variaveis da Vercel.',
    })
  }

  try {
    const [gnewsResult, newsApiResult] = await Promise.allSettled([
      fetchGNews(config.query, gnewsApiKey),
      fetchNewsApi(config.query, config.newsApiCategory, newsApiKey),
    ])

    const gnewsArticles =
      gnewsResult.status === 'fulfilled' ? gnewsResult.value : []
    const newsApiArticles =
      newsApiResult.status === 'fulfilled' ? newsApiResult.value : []

    if (gnewsArticles.length === 0 && newsApiArticles.length === 0) {
      const failures = []

      if (gnewsResult.status === 'rejected') {
        failures.push(`GNews: ${getErrorMessage(gnewsResult.reason, 'falha desconhecida')}`)
      }

      if (newsApiResult.status === 'rejected') {
        failures.push(
          `NewsAPI: ${getErrorMessage(newsApiResult.reason, 'falha desconhecida')}`,
        )
      }

      return sendJson(response, 502, {
        error:
          failures.length > 0
            ? `Nenhuma fonte respondeu com sucesso. ${failures.join(' | ')}`
            : 'Nenhuma noticia foi retornada pelas fontes configuradas.',
      })
    }

    const merged = [
      ...gnewsArticles.map((article) =>
        sanitizeArticle(article, 'GNews', config.topic, config.angle),
      ),
      ...newsApiArticles.map((article) =>
        sanitizeArticle(article, 'NewsAPI', config.topic, config.angle),
      ),
    ]
      .filter(Boolean)

    const deduped = Array.from(
      new Map(
        merged.map((article) => [
          `${article.url.toLowerCase()}::${article.title.toLowerCase()}`,
          article,
        ]),
      ).values(),
    )
      .sort(
        (left, right) =>
          new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
      )
      .slice(0, 18)

    const warnings = []

    if (gnewsResult.status === 'rejected') {
      warnings.push(`GNews indisponivel: ${getErrorMessage(gnewsResult.reason, 'erro desconhecido')}`)
    }

    if (newsApiResult.status === 'rejected') {
      warnings.push(
        `NewsAPI indisponivel: ${getErrorMessage(newsApiResult.reason, 'erro desconhecido')}`,
      )
    }

    return sendJson(response, 200, {
      articles: deduped,
      warnings,
    })
  } catch (error) {
    return sendJson(response, 502, {
      error:
        error instanceof Error
          ? error.message
          : 'Nao foi possivel agregar as noticias agora.',
    })
  }
}
