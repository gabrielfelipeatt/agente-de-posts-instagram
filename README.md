# agente-de-posts-instagram

# Radar Pop

App em React + Vercel para buscar noticias quentes em:

- fofoca
- polemica
- futebol
- influencers
- TV & musica
- bastidores

O painel agrega resultados do `gnews.io` e do `newsapi.org` e usa a Gemini API para gerar uma legenda no estilo de pagina viral de Instagram. Quando a Gemini responde com limite de requisicoes (`429`), a rota tenta automaticamente a Groq como fallback.

## Variaveis de ambiente

Configure estas chaves na Vercel:

```bash
GNEWS_API_KEY=
NEWS_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
```

## Rodar localmente

Frontend puro:

```bash
npm install
npm run dev
```

Observacao:
`npm run dev` sobe apenas o frontend do Vite. As rotas `/api/news` e `/api/generate-caption` nao existem nesse modo e o navegador pode mostrar erros como `Unexpected token '<'`.

Para testar as rotas `/api/*` junto com o frontend localmente, use a CLI da Vercel:

```bash
npx vercel dev
```

## Deploy

1. Suba o projeto para um repositorio Git.
2. Importe na Vercel.
3. Configure as 3 variaveis de ambiente.
4. Faça o deploy.
