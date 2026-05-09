# Dataset Agent 

Веб-приложение для анализа датасетов с использованием ИИ-агента на базе **GitHub Models** (gpt 4.1 и deepseek v3) и облачного интерпретатора **E2B Code Interpreter** (https://e2b.dev/).

## Стэк технологий

- **Frontend**: Next.js 15, React, TailwindCSS, shadcn/ui
- **AI**: Vercel AI SDK + GitHub Models
- **Безопасность**: детерминированный prompt-injection firewall
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
| `E2B_API_KEY` | API ключ E2B Code Interpreter |
| `GH_MODELS_GPT` | токен GitHub Models |

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

При пуше в `main` автоматически деплоится на прод. Сервер развернул у себя дома, Ubuntu 24ая. 

**Необходимые GitHub Secrets:**
- `SSH_PRIVATE_KEY` — приватный SSH ключ
- `E2B_API_KEY` — ключ E2B
- `GH_MODELS_GPT` — токен GitHub Models

## Архитектура

```
Пользователь → Upload файла → Prompt-injection firewall
                                    ↓
                              GitHub Models Agent
                                    ↓
                              E2B Sandbox (Python)
                                    ↓
                              Отчёт + Графики (SSE)
```

## Лицензия

MIT
