# Deployment Runbook

## Dependencies

- PostgreSQL
- Redis
- Discord application and bot token
- Node.js 22+

## Environment

- `DATABASE_URL`
- `REDIS_URL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID` for test-server scoped commands only

## Startup

1. Install dependencies with `npm install`
2. Generate Prisma client with `npm run prisma:generate`
3. Run migrations with `npm run prisma:migrate`
4. Seed defaults with `npm run prisma:seed`
5. Start service with `npm run start:dev`

## Operational notes

- Leave `DISCORD_GUILD_ID` unset in production to register global commands for all servers that install the bot
- Global slash command updates are slower to propagate than guild-scoped commands
- Use one database schema per environment
- Keep Redis durable enough for queued reminders
- Rotate Discord bot token through secret storage
- Monitor queue failures and Prisma connection health
