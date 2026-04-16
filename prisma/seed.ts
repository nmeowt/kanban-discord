import 'dotenv/config';
import { AppRole, PrismaClient, TaskStatusCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const discordGuildId = process.env.DISCORD_GUILD_ID ?? 'local-dev-guild';

  const guild = await prisma.guildConfig.upsert({
    where: { discordGuildId },
    update: {
      name: 'Discord Kanban Workspace',
    },
    create: {
      discordGuildId,
      name: 'Discord Kanban Workspace',
      boards: {
        create: {
          key: 'ENG',
          name: 'Engineering',
        },
      },
    },
    include: {
      boards: true,
    },
  });

  const states = [
    { key: 'backlog', displayName: 'Backlog', category: TaskStatusCategory.BACKLOG, orderIndex: 0 },
    { key: 'todo', displayName: 'Todo', category: TaskStatusCategory.BACKLOG, orderIndex: 1 },
    { key: 'in_progress', displayName: 'In Progress', category: TaskStatusCategory.ACTIVE, orderIndex: 2 },
    { key: 'fixed', displayName: 'Fixed', category: TaskStatusCategory.REVIEW, orderIndex: 3 },
    { key: 'testing', displayName: 'Testing', category: TaskStatusCategory.REVIEW, orderIndex: 4 },
    { key: 'approved', displayName: 'Approved', category: TaskStatusCategory.DONE, orderIndex: 5 },
    { key: 'done', displayName: 'Done', category: TaskStatusCategory.DONE, orderIndex: 6 },
    { key: 'reopened', displayName: 'Reopened', category: TaskStatusCategory.ACTIVE, orderIndex: 7, allowReopen: true },
  ];

  for (const state of states) {
    await prisma.workflowState.upsert({
      where: {
        guildConfigId_key: {
          guildConfigId: guild.id,
          key: state.key,
        },
      },
      update: state,
      create: {
        guildConfigId: guild.id,
        ...state,
      },
    });
  }

  const stateRecords = await prisma.workflowState.findMany({
    where: { guildConfigId: guild.id },
  });

  const byKey = Object.fromEntries(stateRecords.map((state) => [state.key, state]));

  const transitions = [
    ['backlog', 'todo', [AppRole.ADMIN, AppRole.LEAD]],
    ['todo', 'in_progress', [AppRole.ADMIN, AppRole.LEAD, AppRole.DEVELOPER]],
    ['in_progress', 'fixed', [AppRole.ADMIN, AppRole.DEVELOPER]],
    ['fixed', 'testing', [AppRole.ADMIN, AppRole.TESTER, AppRole.LEAD]],
    ['testing', 'approved', [AppRole.ADMIN, AppRole.TESTER, AppRole.APPROVER, AppRole.LEAD]],
    ['testing', 'reopened', [AppRole.ADMIN, AppRole.TESTER, AppRole.APPROVER, AppRole.LEAD]],
    ['approved', 'done', [AppRole.ADMIN, AppRole.APPROVER, AppRole.LEAD]],
    ['reopened', 'in_progress', [AppRole.ADMIN, AppRole.DEVELOPER, AppRole.LEAD]],
  ] as const;

  for (const [fromKey, toKey, allowedRoles] of transitions) {
    await prisma.workflowTransition.upsert({
      where: {
        guildConfigId_fromStateId_toStateId: {
          guildConfigId: guild.id,
          fromStateId: byKey[fromKey].id,
          toStateId: byKey[toKey].id,
        },
      },
      update: {
        allowedRolesJson: allowedRoles,
        requiresReason: toKey === 'reopened',
      },
      create: {
        guildConfigId: guild.id,
        fromStateId: byKey[fromKey].id,
        toStateId: byKey[toKey].id,
        allowedRolesJson: allowedRoles,
        requiresReason: toKey === 'reopened',
      },
    });
  }

  await prisma.notificationRule.upsert({
    where: {
      guildConfigId_eventKey: {
        guildConfigId: guild.id,
        eventKey: 'task.moved',
      },
    },
    update: {},
    create: {
      guildConfigId: guild.id,
      eventKey: 'task.moved',
      isEnabled: true,
    },
  });

  await prisma.notificationRule.upsert({
    where: {
      guildConfigId_eventKey: {
        guildConfigId: guild.id,
        eventKey: 'task.assigned',
      },
    },
    update: {},
    create: {
      guildConfigId: guild.id,
      eventKey: 'task.assigned',
      isEnabled: true,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
