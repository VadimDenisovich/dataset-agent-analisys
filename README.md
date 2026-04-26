# Dataset Agent — Интеллектуальный анализ данных

Веб-приложение для анализа датасетов с использованием ИИ-агента на базе **Gemini 2.5 Pro** и облачного интерпретатора **E2B Code Interpreter**.

## Стэк технологий

- **Frontend**: Next.js 15 (App Router), React, TailwindCSS, shadcn/ui
- **AI**: Vercel AI SDK + Google Gemini 2.5 Pro
- **Безопасность**: LLM Firewall (Gemini 2.5 Flash)
- **Code Execution**: E2B Code Interpreter (облачная Python-песочница)
- **DevOps**: Docker, Nginx, Certbot (Let's Encrypt), GitHub Actions

## Быстрый старт

```bash
# 1. Установите зависимости
npm install

# 2. Скопируйте и заполните .env.local
cp .env.example .env.local

# 3. Запустите dev-сервер
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Переменные окружения

| Переменная | Описание |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | API ключ Google Gemini |
| `E2B_API_KEY` | API ключ E2B Code Interpreter |

## Деплой

### Docker (продакшн)

```bash
# Первичная настройка SSL
chmod +x nginx/certbot-init.sh
./nginx/certbot-init.sh

# Запуск
docker compose up -d --build
```

### GitHub Actions

При пуше в `main` автоматически деплоится на сервер `31.200.229.59`.

**Необходимые GitHub Secrets:**
- `SSH_PRIVATE_KEY` — приватный SSH ключ
- `GOOGLE_API_KEY` — ключ Gemini API
- `E2B_API_KEY` — ключ E2B

## Архитектура

```
Пользователь → Upload файла → LLM Firewall (Gemini Flash)
                                    ↓
                              Gemini 2.5 Pro Agent
                                    ↓
                              E2B Sandbox (Python)
                                    ↓
                              Отчёт + Графики (SSE)
```

## Лицензия

MIT
