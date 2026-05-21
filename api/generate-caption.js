const CTA =
  'Para nao perder nada do mundo dos famosos, siga a nossa pagina agora mesmo! @kayle.kloss'

class ProviderError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'ProviderError'
    this.provider = options.provider || 'unknown'
    this.statusCode = options.statusCode || 500
    this.retryable = options.retryable || false
  }
}

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body)
}

function buildPrompt(article) {
  return `
Atue como um redator especialista em perfis de fofoca e celebridades do Instagram, no estilo de paginas virais de entretenimento.

Seu objetivo e reescrever a noticia abaixo no formato ideal para Instagram.

Diretrizes obrigatorias:
- Titulo impactante em LETRAS MAIUSCULAS.
- Use emojis de alerta como 🚨, 💥 e 🤯.
- Varie entre expressoes como EXCLUSIVO, CHUTOU O BALDE, QUEBRA-PAU, SURREAL, CLIMA AZEDOU, BASTIDORES, URGENTE.
- Evite repetir sempre a mesma abertura.
- Corpo do texto com tom informal, fofoqueiro, agil e envolvente.
- Use algumas palavras em MAIUSCULAS no meio do texto para reforco.
- Termine com uma pergunta instigante para gerar comentarios.
- No final, inclua exatamente esta CTA em negrito:
**👉 ${CTA}🔔**
- Inclua de 5 a 8 hashtags relevantes.
- Nao use markdown extra alem do negrito da CTA.
- Entregue apenas a legenda final.

Noticia:
Tema: ${article.topic}
Gancho sugerido: ${article.angle}
Titulo: ${article.title}
Descricao: ${article.description || 'Sem descricao adicional'}
Conteudo: ${article.content || 'Sem conteudo adicional'}
Fonte: ${article.source}
Link: ${article.url}
`.trim()
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  )
}

function getGroqApiKey() {
  return process.env.GROQ_API_KEY || ''
}

async function getRequestBody(request) {
  if (request.body && typeof request.body === 'object') {
    return request.body
  }

  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body)
  }

  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function readGeminiCaption(data) {
  const caption =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('\n')
      .trim() || ''

  if (!caption) {
    throw new ProviderError('O Gemini nao retornou uma legenda.', {
      provider: 'gemini',
      statusCode: 502,
    })
  }

  return caption
}

function normalizeGeminiError(statusCode, data) {
  const apiMessage = data?.error?.message

  if (statusCode === 400 && typeof apiMessage === 'string') {
    if (apiMessage.includes('API key not valid')) {
      return new ProviderError(
        'A chave da Gemini foi rejeitada. Gere uma nova chave no Google AI Studio e atualize GEMINI_API_KEY.',
        { provider: 'gemini', statusCode },
      )
    }

    return new ProviderError(apiMessage, {
      provider: 'gemini',
      statusCode,
    })
  }

  if (statusCode === 403) {
    return new ProviderError(
      'A Gemini bloqueou a requisicao. Verifique se a API Generative Language esta habilitada para essa chave.',
      { provider: 'gemini', statusCode },
    )
  }

  if (statusCode === 429) {
    return new ProviderError(
      'Limite de requisicoes da Gemini atingido.',
      { provider: 'gemini', statusCode, retryable: true },
    )
  }

  return new ProviderError(apiMessage || 'Falha ao consultar o Gemini.', {
    provider: 'gemini',
    statusCode,
  })
}

async function generateWithGemini(prompt, apiKey) {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.95,
          topP: 0.95,
          maxOutputTokens: 700,
        },
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw normalizeGeminiError(response.status, data)
  }

  return readGeminiCaption(data)
}

function normalizeGroqError(statusCode, data) {
  const apiMessage = data?.error?.message

  if (statusCode === 401) {
    return new ProviderError(
      'A chave da Groq foi rejeitada. Atualize GROQ_API_KEY.',
      { provider: 'groq', statusCode },
    )
  }

  if (statusCode === 429) {
    return new ProviderError(
      'Limite de requisicoes da Groq atingido.',
      { provider: 'groq', statusCode, retryable: true },
    )
  }

  return new ProviderError(apiMessage || 'Falha ao consultar a Groq.', {
    provider: 'groq',
    statusCode,
  })
}

async function generateWithGroq(prompt, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.95,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw normalizeGroqError(response.status, data)
  }

  const caption = data?.choices?.[0]?.message?.content?.trim() || ''

  if (!caption) {
    throw new ProviderError('A Groq nao retornou uma legenda.', {
      provider: 'groq',
      statusCode: 502,
    })
  }

  return caption
}

async function generateCaptionWithFallback(prompt) {
  const geminiApiKey = getGeminiApiKey()
  const groqApiKey = getGroqApiKey()

  if (!geminiApiKey && !groqApiKey) {
    throw new ProviderError(
      'Defina GEMINI_API_KEY, GOOGLE_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou GROQ_API_KEY nas variaveis de ambiente.',
      { statusCode: 500 },
    )
  }

  if (!geminiApiKey && groqApiKey) {
    return generateWithGroq(prompt, groqApiKey)
  }

  try {
    return await generateWithGemini(prompt, geminiApiKey)
  } catch (error) {
    if (
      error instanceof ProviderError &&
      error.provider === 'gemini' &&
      error.statusCode === 429 &&
      groqApiKey
    ) {
      return generateWithGroq(prompt, groqApiKey)
    }

    throw error
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Metodo nao permitido.' })
  }

  try {
    const body = await getRequestBody(request)
    const article = body?.article

    if (!article?.title || !article?.url) {
      return sendJson(response, 400, {
        error: 'Envie uma noticia valida para gerar a legenda.',
      })
    }

    const caption = await generateCaptionWithFallback(buildPrompt(article))
    return sendJson(response, 200, { caption })
  } catch (error) {
    return sendJson(response, error?.statusCode || 502, {
      error:
        error instanceof Error
          ? error.message
          : 'Nao foi possivel gerar a legenda agora.',
    })
  }
}
