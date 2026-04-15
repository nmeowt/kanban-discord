# Discord Kanban Bot

A Discord-first task and bug tracking bot for teams that want lightweight Kanban workflow management directly inside a Discord server.

This project is built for teams such as engineering, QA, and leads who want to:

- map Discord server roles to bot permissions
- create tasks and bugs inside Discord
- assign work to specific users
- update tasks and bugs after creation
- move work through a Kanban workflow
- review, approve, or reopen work
- set deadlines and receive reminders when work is due soon or overdue
- view the full board grouped by workflow state

## Stack

- Node.js
- TypeScript
- NestJS
- Prisma
- PostgreSQL
- Redis
- BullMQ
- discord.js

## Core concepts

### 1. Discord roles are for permissions
The bot does not manage Discord server roles for members.

Instead, a server owner or server admin maps existing Discord roles to bot permission roles:

- `ADMIN`
- `LEAD`
- `DEVELOPER`
- `TESTER`
- `APPROVER`

Example:

- Discord role `Lead` -> bot role `LEAD`
- Discord role `Developer` -> bot role `DEVELOPER`
- Discord role `QA` -> bot role `TESTER`

### 2. Task assignment is always to a specific user
Tasks are assigned to a Discord user, not to a role.

Example:

- `/task assign task:"Build login" assignee:@alice`

If the assignee is wrong, the task can be corrected later with:

- `/task update`
- `/task assign`
- `/task unassign`

The bot still generates an internal code like `ENG-1`, but users do not need to type or rely on that code in normal command usage.
Task selection should happen by task title through Discord autocomplete.

### 3. Kanban board shows all tasks
`/board view` loads all non-archived tasks for the current guild and groups them by workflow state:

- Backlog
- Todo
- In Progress
- Fixed
- Testing
- Approved
- Done
- Reopened

### 4. Deadlines and reminders
Tasks can include a deadline at creation time or later through `/task deadline`.

If a task is still not in `Done`, the background reminder job checks deadlines and can post reminders to the configured notification channel:

- due soon reminder within 24 hours of the deadline
- overdue reminder after the deadline passes
- repeated overdue reminders with a cooldown to avoid spam

## Current command support

### Admin

- `/admin roles`
- `/admin settings`
- `/admin workflow`

### Task

- `/task create`
- `/task update`
- `/task assign`
- `/task unassign`
- `/task archive`
- `/task move`
- `/task approve`
- `/task reject`
- `/task list`
- `/task my`
- `/task due_today`
- `/task overdue`
- `/task deadline`
- `/task view`

### Bug

- `/bug create`
- `/bug update`

### Board

- `/board view`

### Workflow

- `/workflow view`

## Setup

### Requirements

- Node.js 22+
- PostgreSQL
- Redis
- A Discord application with a bot

### Environment variables

Create `.env` from `.env.example`.

Required values:

```env
DATABASE_URL="postgresql://username@localhost:5432/kanban_discord?schema=public"
REDIS_URL="redis://localhost:6379"
DISCORD_BOT_TOKEN="your_bot_token"
DISCORD_CLIENT_ID="your_application_id"
DISCORD_PUBLIC_KEY="your_public_key"
DISCORD_GUILD_ID="your_test_server_id"
PORT=3000
```

### Install and run

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run start:dev
```

## Discord setup

### 1. Create the Discord application

- Open [Discord Developer Portal](https://discord.com/developers/applications)
- Create or select your application
- Copy:
- `Application ID`
- `Public Key`
- Go to `Bot`
- Create the bot if needed
- Copy or reset the bot token
- Add a bot avatar in the `Bot` tab if you want branded installation and member list presence

### 2. Invite the bot

Use this format:

```text
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot%20applications.commands
```

For broad rollout, enable `SERVER MEMBERS INTENT` only if you add features that require it. The current bot only needs slash commands in servers.

### 3. Get the server ID

- Enable Discord Developer Mode
- Right-click the server
- Copy the server ID
- Put it in `DISCORD_GUILD_ID` for fast test-server command registration

If you want the bot to be installable across multiple servers, leave `DISCORD_GUILD_ID` empty. The bot will register global slash commands instead. Discord can take up to about an hour to propagate global commands.

## Recommended first-time setup flow

### Step 1. Start the bot

```bash
npm run start:dev
```

### Step 2. Map server roles to bot permissions

```text
/admin roles action:View mappings
/admin roles action:Map role to permission discord_role:@Lead app_role:LEAD
/admin roles action:Map role to permission discord_role:@Developer app_role:DEVELOPER
/admin roles action:Map role to permission discord_role:@Tester app_role:TESTER
```

### Step 3. Check settings

```text
/admin settings action:View settings
/admin settings action:Set notification channel notification_channel:#kanban-bot
```

### Step 4. Create, assign, and schedule work

```text
/task create title:"Build login" description:"Add Discord login flow" priority:HIGH assignee:@alice due_date:2026-04-20
/bug create title:"Fix crash" description:"App crashes on startup" priority:CRITICAL assignee:@bob due_date:2026-04-16
/task update task:"Build login" title:"Build login v2" assignee:@bob due_date:2026-04-22
/task assign task:"Build login" assignee:@alice
/task deadline action:set task:"Build login" due_date:2026-04-20
```

### Step 5. Move work through the board

```text
/task move task:"Build login" to_state:in_progress
/task move task:"Build login" to_state:fixed
/task move task:"Build login" to_state:testing
/task approve task:"Build login"
```

### Step 6. Track urgent work

```text
/task my
/task due_today
/task overdue
/board view
/workflow view
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Command Reference](./docs/command-reference.md)
- [Discord Dialogs](./docs/discord-dialogs.md)
- [Deployment](./docs/deployment.md)
- [User Flow Diagram](./docs/user-flow.md)

## Notes

- The bot uses Discord roles only to determine permissions.
- The bot assigns tasks to individual users.
- The board view is a Kanban summary of all non-archived tasks in the server.
- Admin commands are restricted to the server owner or users with the `Administrator` permission.
- Deadline reminders use the configured notification channel.

## Security

- Never commit bot tokens to the repository.
- If a token is exposed, rotate it immediately in the Discord Developer Portal.
