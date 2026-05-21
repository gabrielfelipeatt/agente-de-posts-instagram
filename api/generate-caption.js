const CTA =
  '👉 Para não perder nada do mundo dos famosos, siga a nossa página agora mesmo! @kayle.kloss🔔'

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
**${CTA}**
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

function normalizeGeminiError(statusCode, data) {
  const apiMessage = data?.error?.message

  if (statusCode === 400 && typeof apiMessage === 'string') {
    if (apiMessage.includes('API key not valid')) {
      return 'A chave da Gemini foi rejeitada. Gere uma nova chave no Google AI Studio e atualize GEMINI_API_KEY.'
    }

    return apiMessage
  }

  if (statusCode === 403) {
    return 'A Gemini bloqueou a requisicao. Verifique se a API Generative Language esta habilitada para essa chave.'
  }

  if (statusCode === 429) {
    return 'Limite de requisicoes da Gemini atingido. Aguarde um pouco e tente novamente.'
  }

  return apiMessage || 'Falha ao consultar o Gemini.'
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
    throw new Error(normalizeGeminiError(response.status, data))
  }

  const caption =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('\n')
      .trim() || ''

  if (!caption) {
    throw new Error('O Gemini nao retornou uma legenda.')
  }

  return caption
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Metodo nao permitido.' })
  }

  const geminiApiKey = getGeminiApiKey()

  if (!geminiApiKey) {
    return sendJson(response, 500, {
      error:
        'Defina GEMINI_API_KEY, GOOGLE_API_KEY ou GOOGLE_GENERATIVE_AI_API_KEY nas variaveis de ambiente.',
    })
  }

  try {
    const body = await getRequestBody(request)
    const article = body?.article

    if (!article?.title || !article?.url) {
      return sendJson(response, 400, {
        error: 'Envie uma noticia valida para gerar a legenda.',
      })
    }

    const caption = await generateWithGemini(buildPrompt(article), geminiApiKey)
    return sendJson(response, 200, { caption })
  } catch (error) {
    return sendJson(response, 502, {
      error:
        error instanceof Error
          ? error.message
          : 'Nao foi possivel gerar a legenda agora.',
    })
  }
}
