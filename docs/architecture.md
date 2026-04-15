# Architecture

## Stack

- NestJS for app structure and dependency injection
- discord.js for Discord commands, modals, and buttons
- Prisma + PostgreSQL for relational workflow data
- Redis + BullMQ for reminders and notification jobs

## Runtime model

- Single Node.js service
- Discord bot bootstrap on app startup
- Internal HTTP surface for health and future admin API
- SQL as source of truth
- Redis for jobs and transient queue state only

## Domain boundaries

- `TasksModule`: task lifecycle, assignment, approvals, audit, notifications
- `DiscordModule`: command registration and interaction entrypoints
- `JobsModule`: scheduled reminders and retryable async work
- `PrismaModule`: database access

## Data model

- `GuildConfig`: per-server configuration
- `Board`: board/project container
- `RoleMapping`: Discord role to app role mapping
- `WorkflowState`: configurable kanban stages
- `WorkflowTransition`: allowed state changes and required roles
- `Task`: task or bug item
- `TaskTransition`: audit trail of movement
- `TaskAssignment`: assignment history
- `ApprovalDecision`: approve/reject events
- `NotificationRule`: event-driven notifications
