import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AppRole,
  ApprovalDecisionStatus,
  Prisma,
  TaskPriority,
  TaskType,
} from '@prisma/client';
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  GuildMemberRoleManager,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../tasks/permission.service';
import { SettingsService } from '../tasks/settings.service';
import { WorkflowService } from '../tasks/workflow.service';

type TaskPermission = 'task:create' | 'task:assign' | 'task:move' | 'task:approve' | 'task:admin';

type GuildConfigWithRelations = Prisma.GuildConfigGetPayload<{
  include: {
    boards: true;
    workflowStates: true;
    workflowTransitions: true;
    roleMappings: true;
    notificationRules: true;
  };
}>;

@Injectable()
export class DiscordService implements OnModuleInit {
  private readonly logger = new Logger(DiscordService.name);
  private readonly client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
    private readonly settingsService: SettingsService,
    private readonly permissionService: PermissionService,
  ) {}

  async onModuleInit() {
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!token || !clientId || !guildId) {
      this.logger.warn('Discord credentials missing. Bot bootstrap skipped.');
      return;
    }

    await this.registerCommands(token, clientId, guildId);

    this.client.once('ready', () => {
      this.logger.log(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isAutocomplete()) {
        await this.handleAutocomplete(interaction);
        return;
      }

      if (!interaction.isChatInputCommand()) {
        return;
      }

      try {
        await this.handleChatInput(interaction);
      } catch (error) {
        this.logger.error('Discord command failed', error instanceof Error ? error.stack : String(error));
        const content = 'Command failed. Check server config, role mapping, or required command options.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ ephemeral: true, content });
          return;
        }

        await interaction.reply({ ephemeral: true, content });
      }
    });

    await this.client.login(token);
  }

  private async registerCommands(token: string, clientId: string, guildId: string) {
    const stateChoices = [
      { name: 'Backlog', value: 'backlog' },
      { name: 'Todo', value: 'todo' },
      { name: 'In Progress', value: 'in_progress' },
      { name: 'Fixed', value: 'fixed' },
      { name: 'Testing', value: 'testing' },
      { name: 'Approved', value: 'approved' },
      { name: 'Done', value: 'done' },
      { name: 'Reopened', value: 'reopened' },
    ] as const;

    const priorityChoices = [
      { name: 'LOW', value: 'LOW' },
      { name: 'MEDIUM', value: 'MEDIUM' },
      { name: 'HIGH', value: 'HIGH' },
      { name: 'CRITICAL', value: 'CRITICAL' },
    ] as const;

    const commands = [
      new SlashCommandBuilder()
        .setName('task')
        .setDescription('Task operations')
        .addSubcommand((sub) =>
          sub
            .setName('create')
            .setDescription('Create a task')
            .addStringOption((option) => option.setName('title').setDescription('Task title').setRequired(true))
            .addStringOption((option) => option.setName('description').setDescription('Task description').setRequired(true))
            .addStringOption((option) => option.setName('priority').setDescription('Task priority').setRequired(true).addChoices(...priorityChoices))
            .addUserOption((option) => option.setName('assignee').setDescription('Assign to a specific Discord user'))
            .addStringOption((option) => option.setName('labels').setDescription('Comma-separated labels'))
            .addStringOption((option) => option.setName('due_date').setDescription('Deadline in YYYY-MM-DD or ISO format')),
        )
        .addSubcommand((sub) =>
          sub
            .setName('update')
            .setDescription('Update task metadata')
            .addStringOption((option) => option.setName('task').setDescription('Select a task').setRequired(true).setAutocomplete(true))
            .addStringOption((option) => option.setName('title').setDescription('New title'))
            .addStringOption((option) => option.setName('description').setDescription('New description'))
            .addStringOption((option) => option.setName('priority').setDescription('New priority').addChoices(...priorityChoices))
            .addUserOption((option) => option.setName('assignee').setDescription('Reassign to a user'))
            .addStringOption((option) => option.setName('labels').setDescription('Comma-separated labels'))
            .addStringOption((option) => option.setName('due_date').setDescription('New deadline in YYYY-MM-DD or ISO format')),
        )
        .addSubcommand((sub) =>
          sub
            .setName('assign')
            .setDescription('Assign a task to a specific user')
            .addStringOption((option) => option.setName('task').setDescription('Select a task').setRequired(true).setAutocomplete(true))
            .addUserOption((option) => option.setName('assignee').setDescription('User to assign').setRequired(true))
            .addStringOption((option) => option.setName('note').setDescription('Optional assignment note')),
        )
        .addSubcommand((sub) =>
          sub
            .setName('unassign')
            .setDescription('Remove current assignee from a task')
            .addStringOption((option) => option.setName('task').setDescription('Select a task').setRequired(true).setAutocomplete(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName('archive')
            .setDescription('Archive a task so it disappears from board and lists')
            .addStringOption((option) => option.setName('task').setDescription('Select a task').setRequired(true).setAutocomplete(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName('move')
            .setDescription('Move a task to another workflow state')
            .addStringOption((option) => option.setName('task').setDescription('Select a task').setRequired(true).setAutocomplete(true))
            .addStringOption((option) => option.setName('to_state').setDescription('Target workflow state').setRequired(true).addChoices(...stateChoices))
            .addStringOption((option) => option.setName('reason').setDescription('Reason, required when reopening')),
        )
        .addSubcommand((sub) =>
          sub
            .setName('approve')
            .setDescription('Approve a task')
            .addStringOption((option) => option.setName('task').setDescription('Select a task').setRequired(true).setAutocomplete(true))
            .addStringOption((option) => option.setName('note').setDescription('Optional approval note')),
        )
        .addSubcommand((sub) =>
          sub
            .setName('reject')
            .setDescription('Reject a task and reopen it')
            .addStringOption((option) => option.setName('task').setDescription('Select a task').setRequired(true).setAutocomplete(true))
            .addStringOption((option) => option.setName('reason').setDescription('Reason for rejection').setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName('list')
            .setDescription('List tasks')
            .addStringOption((option) => option.setName('state').setDescription('Optional workflow state filter').addChoices(...stateChoices)),
        )
        .addSubcommand((sub) => sub.setName('my').setDescription('List tasks assigned to you'))
        .addSubcommand((sub) => sub.setName('due_today').setDescription('List tasks due today'))
        .addSubcommand((sub) => sub.setName('overdue').setDescription('List overdue tasks'))
        .addSubcommand((sub) =>
          sub
            .setName('deadline')
            .setDescription('Set or clear a task deadline')
            .addStringOption((option) =>
              option
                .setName('action')
                .setDescription('Choose a deadline action')
                .setRequired(true)
                .addChoices(
                  { name: 'Set deadline', value: 'set' },
                  { name: 'Clear deadline', value: 'clear' },
                ),
            )
            .addStringOption((option) => option.setName('task').setDescription('Select a task').setRequired(true).setAutocomplete(true))
            .addStringOption((option) => option.setName('due_date').setDescription('Deadline in YYYY-MM-DD or ISO format')),
        )
        .addSubcommand((sub) =>
          sub
            .setName('view')
            .setDescription('View task details')
            .addStringOption((option) => option.setName('task').setDescription('Select a task').setRequired(true).setAutocomplete(true)),
        )
        .toJSON(),
      new SlashCommandBuilder()
        .setName('bug')
        .setDescription('Bug operations')
        .addSubcommand((sub) =>
          sub
            .setName('create')
            .setDescription('Create a bug')
            .addStringOption((option) => option.setName('title').setDescription('Bug title').setRequired(true))
            .addStringOption((option) => option.setName('description').setDescription('Bug description').setRequired(true))
            .addStringOption((option) => option.setName('priority').setDescription('Bug priority').setRequired(true).addChoices(...priorityChoices))
            .addUserOption((option) => option.setName('assignee').setDescription('Assign to a specific Discord user'))
            .addStringOption((option) => option.setName('labels').setDescription('Comma-separated labels'))
            .addStringOption((option) => option.setName('due_date').setDescription('Deadline in YYYY-MM-DD or ISO format')),
        )
        .addSubcommand((sub) =>
          sub
            .setName('update')
            .setDescription('Update bug metadata')
            .addStringOption((option) => option.setName('task').setDescription('Select a bug').setRequired(true).setAutocomplete(true))
            .addStringOption((option) => option.setName('title').setDescription('New title'))
            .addStringOption((option) => option.setName('description').setDescription('New description'))
            .addStringOption((option) => option.setName('priority').setDescription('New priority').addChoices(...priorityChoices))
            .addUserOption((option) => option.setName('assignee').setDescription('Reassign to a user'))
            .addStringOption((option) => option.setName('labels').setDescription('Comma-separated labels'))
            .addStringOption((option) => option.setName('due_date').setDescription('New deadline in YYYY-MM-DD or ISO format')),
        )
        .toJSON(),
      new SlashCommandBuilder()
        .setName('board')
        .setDescription('Board operations')
        .addSubcommand((sub) => sub.setName('view').setDescription('View the kanban board with all non-archived tasks grouped by state'))
        .toJSON(),
      new SlashCommandBuilder()
        .setName('workflow')
        .setDescription('Workflow reference commands')
        .addSubcommand((sub) => sub.setName('view').setDescription('View workflow states and transitions'))
        .toJSON(),
      new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Guild admin operations')
        .addSubcommand((sub) => sub.setName('workflow').setDescription('View workflow states and transitions'))
        .addSubcommand((sub) =>
          sub
            .setName('roles')
            .setDescription('Map Discord roles to bot permissions')
            .addStringOption((option) =>
              option
                .setName('action')
                .setDescription('Choose an admin action')
                .setRequired(true)
                .addChoices(
                  { name: 'View mappings', value: 'view' },
                  { name: 'Map role to permission', value: 'set' },
                  { name: 'Remove role mapping', value: 'remove' },
                ),
            )
            .addRoleOption((option) => option.setName('discord_role').setDescription('Existing Discord server role'))
            .addStringOption((option) =>
              option
                .setName('app_role')
                .setDescription('Bot permission role')
                .addChoices(
                  { name: 'ADMIN', value: 'ADMIN' },
                  { name: 'LEAD', value: 'LEAD' },
                  { name: 'DEVELOPER', value: 'DEVELOPER' },
                  { name: 'TESTER', value: 'TESTER' },
                  { name: 'APPROVER', value: 'APPROVER' },
                ),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('settings')
            .setDescription('View or update guild settings')
            .addStringOption((option) =>
              option
                .setName('action')
                .setDescription('Choose an admin action')
                .setRequired(true)
                .addChoices(
                  { name: 'View settings', value: 'view' },
                  { name: 'Set notification channel', value: 'set_notification_channel' },
                  { name: 'Clear notification channel', value: 'clear_notification_channel' },
                ),
            )
            .addChannelOption((option) => option.setName('notification_channel').setDescription('Channel used for bot notifications')),
        )
        .toJSON(),
    ];

    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
  }

  private async handleChatInput(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand(false);

    if (interaction.commandName === 'task') {
      await this.handleTaskCommand(interaction, subcommand);
      return;
    }

    if (interaction.commandName === 'bug') {
      await this.handleBugCommand(interaction, subcommand);
      return;
    }

    if (interaction.commandName === 'board' && subcommand === 'view') {
      await this.handleBoardView(interaction);
      return;
    }

    if (interaction.commandName === 'workflow' && subcommand === 'view') {
      await this.handleWorkflowView(interaction);
      return;
    }

    if (interaction.commandName === 'admin' && subcommand === 'workflow') {
      await this.handleWorkflowView(interaction);
      return;
    }

    if (interaction.commandName === 'admin' && subcommand === 'settings') {
      await this.handleSettingsView(interaction);
      return;
    }

    if (interaction.commandName === 'admin' && subcommand === 'roles') {
      await this.handleRolesView(interaction);
      return;
    }

    await interaction.reply({
      ephemeral: true,
      content: `Received /${interaction.commandName} ${subcommand ?? ''}. This command is registered, but its full workflow is not implemented yet.`,
    });
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) {
      await interaction.respond([]);
      return;
    }

    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'task') {
      await interaction.respond([]);
      return;
    }

    const guildConfig = await this.prisma.guildConfig.findUnique({
      where: { discordGuildId: interaction.guildId },
    });

    if (!guildConfig) {
      await interaction.respond([]);
      return;
    }

    const query = String(focused.value ?? '').trim();
    const tasks = await this.prisma.task.findMany({
      where: {
        guildConfigId: guildConfig.id,
        archivedAt: null,
        title: query
          ? {
              contains: query,
              mode: 'insensitive',
            }
          : undefined,
      },
      include: {
        workflowState: true,
      },
      orderBy: [
        { updatedAt: 'desc' },
      ],
      take: 25,
    });

    await interaction.respond(
      tasks.map((task) => ({
        name: `${this.truncate(task.title, 65)} • ${task.workflowState.displayName}`,
        value: task.id,
      })),
    );
  }

  private async handleTaskCommand(interaction: ChatInputCommandInteraction, subcommand: string | null) {
    if (subcommand === 'create') return this.handleCreateTask(interaction, 'TASK');
    if (subcommand === 'update') return this.handleUpdateTask(interaction, 'TASK');
    if (subcommand === 'assign') return this.handleAssignTask(interaction);
    if (subcommand === 'unassign') return this.handleUnassignTask(interaction);
    if (subcommand === 'archive') return this.handleArchiveTask(interaction);
    if (subcommand === 'move') return this.handleMoveTask(interaction);
    if (subcommand === 'view') return this.handleViewTask(interaction);
    if (subcommand === 'list') return this.handleListTasks(interaction);
    if (subcommand === 'my') return this.handleMyTasks(interaction);
    if (subcommand === 'due_today') return this.handleDueToday(interaction);
    if (subcommand === 'overdue') return this.handleOverdue(interaction);
    if (subcommand === 'deadline') return this.handleDeadline(interaction);
    if (subcommand === 'approve') return this.handleApproval(interaction, 'APPROVED');
    if (subcommand === 'reject') return this.handleApproval(interaction, 'REJECTED');
  }

  private async handleBugCommand(interaction: ChatInputCommandInteraction, subcommand: string | null) {
    if (subcommand === 'create') return this.handleCreateTask(interaction, 'BUG');
    if (subcommand === 'update') return this.handleUpdateTask(interaction, 'BUG');
  }

  private async handleCreateTask(interaction: ChatInputCommandInteraction, type: TaskType) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    const actorRoles = this.resolveActorAppRoles(interaction, guildConfig.roleMappings);
    if (!this.canUseTaskPermission(actorRoles, interaction, 'task:create')) return;

    const board = guildConfig.boards[0];
    const initialState = guildConfig.workflowStates.find((state) => state.key === 'backlog') ?? guildConfig.workflowStates[0];
    if (!board || !initialState) {
      await interaction.reply({ ephemeral: true, content: 'Guild configuration is incomplete. Missing board or workflow states.' });
      return;
    }

    const count = await this.prisma.task.count({ where: { boardId: board.id } });
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const priority = interaction.options.getString('priority', true) as TaskPriority;
    const assignee = interaction.options.getUser('assignee');
    const labelsRaw = interaction.options.getString('labels');
    const dueInput = interaction.options.getString('due_date');
    const parsedDueDate = this.parseDueDate(dueInput);
    if (dueInput && !parsedDueDate) {
      await interaction.reply({ ephemeral: true, content: 'Invalid `due_date`. Use `YYYY-MM-DD` or a valid ISO date.' });
      return;
    }

    const externalKey = `${board.key}-${count + 1}`;
    const task = await this.prisma.task.create({
      data: {
        guildConfigId: guildConfig.id,
        boardId: board.id,
        externalKey,
        title,
        description,
        type,
        priority,
        workflowStateId: initialState.id,
        createdByDiscordId: interaction.user.id,
        assigneeDiscordId: assignee?.id,
        dueDate: parsedDueDate,
        labelsJson: this.parseLabels(labelsRaw),
      },
      include: { workflowState: true },
    });

    if (assignee) {
      await this.prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          assignedByDiscordId: interaction.user.id,
          assigneeDiscordId: assignee.id,
          note: 'Assigned during task creation',
        },
      });
    }

    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle(task.title)
          .setDescription('Created successfully')
          .addFields(
            { name: 'Type', value: task.type, inline: true },
            { name: 'Priority', value: task.priority, inline: true },
            { name: 'State', value: task.workflowState.displayName, inline: true },
            { name: 'Assignee', value: task.assigneeDiscordId ? `<@${task.assigneeDiscordId}>` : 'Unassigned', inline: true },
            { name: 'Deadline', value: this.formatDueDate(task.dueDate), inline: true },
          )
          .setColor(type === 'BUG' ? 0xdc2626 : 0x2563eb),
      ],
    });
  }

  private async handleUpdateTask(interaction: ChatInputCommandInteraction, expectedType: TaskType) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    const actorRoles = this.resolveActorAppRoles(interaction, guildConfig.roleMappings);
    if (!this.canUseTaskPermission(actorRoles, interaction, 'task:create')) return;

    const taskId = interaction.options.getString('task', true);
    const task = await this.findTaskOrReply(interaction, guildConfig.id, taskId);
    if (!task) return;
    if (task.type !== expectedType) {
      await interaction.reply({
        ephemeral: true,
        content: expectedType === 'BUG' ? `"${task.title}" is not a bug.` : `"${task.title}" is not a task.`,
      });
      return;
    }

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const priority = interaction.options.getString('priority') as TaskPriority | null;
    const assignee = interaction.options.getUser('assignee');
    const labelsRaw = interaction.options.getString('labels');
    const dueInput = interaction.options.getString('due_date');
    const parsedDueDate = dueInput ? this.parseDueDate(dueInput) : undefined;
    if (dueInput && !parsedDueDate) {
      await interaction.reply({ ephemeral: true, content: 'Invalid `due_date`. Use `YYYY-MM-DD` or a valid ISO date.' });
      return;
    }

    const data: Prisma.TaskUpdateInput = {};
    if (title) data.title = title;
    if (description) data.description = description;
    if (priority) data.priority = priority;
    if (assignee) data.assigneeDiscordId = assignee.id;
    if (labelsRaw !== null) data.labelsJson = this.parseLabels(labelsRaw);
    if (dueInput !== null) {
      data.dueDate = parsedDueDate ?? null;
      data.lastReminderAt = null;
      data.lastReminderType = null;
    }

    if (Object.keys(data).length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: 'No changes provided. Pass at least one field like title, description, priority, assignee, labels, or due_date.',
      });
      return;
    }

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data,
    });

    if (assignee && assignee.id !== task.assigneeDiscordId) {
      await this.prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          assignedByDiscordId: interaction.user.id,
          assigneeDiscordId: assignee.id,
          note: 'Reassigned during task update',
        },
      });
    }

    await interaction.reply({
      ephemeral: true,
      content: `Updated **${updated.title}**. Assignee: ${updated.assigneeDiscordId ? `<@${updated.assigneeDiscordId}>` : 'Unassigned'} | Deadline: ${this.formatDueDate(updated.dueDate)}.`,
    });
  }

  private async handleAssignTask(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;
    const actorRoles = this.resolveActorAppRoles(interaction, guildConfig.roleMappings);
    if (!this.canUseTaskPermission(actorRoles, interaction, 'task:assign')) return;

    const taskId = interaction.options.getString('task', true);
    const assignee = interaction.options.getUser('assignee', true);
    const note = interaction.options.getString('note');
    const task = await this.findTaskOrReply(interaction, guildConfig.id, taskId);
    if (!task) return;

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: { assigneeDiscordId: assignee.id },
    });

    await this.prisma.taskAssignment.create({
      data: {
        taskId: task.id,
        assignedByDiscordId: interaction.user.id,
        assigneeDiscordId: assignee.id,
        note,
      },
    });

    await interaction.reply({ ephemeral: true, content: `Assigned **${updated.title}** to <@${assignee.id}>.` });
  }

  private async handleUnassignTask(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;
    const actorRoles = this.resolveActorAppRoles(interaction, guildConfig.roleMappings);
    if (!this.canUseTaskPermission(actorRoles, interaction, 'task:assign')) return;

    const taskId = interaction.options.getString('task', true);
    const task = await this.findTaskOrReply(interaction, guildConfig.id, taskId);
    if (!task) return;

    await this.prisma.task.update({
      where: { id: task.id },
      data: { assigneeDiscordId: null },
    });

    await interaction.reply({ ephemeral: true, content: `Removed assignee from **${task.title}**.` });
  }

  private async handleArchiveTask(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;
    const actorRoles = this.resolveActorAppRoles(interaction, guildConfig.roleMappings);
    if (!this.canUseTaskPermission(actorRoles, interaction, 'task:assign')) return;

    const taskId = interaction.options.getString('task', true);
    const task = await this.findTaskOrReply(interaction, guildConfig.id, taskId);
    if (!task) return;

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        archivedAt: new Date(),
        lastReminderAt: null,
        lastReminderType: null,
      },
    });

    await interaction.reply({ ephemeral: true, content: `Archived **${task.title}**. It will no longer appear in board and list views.` });
  }

  private async handleMoveTask(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;
    const actorRoles = this.resolveActorAppRoles(interaction, guildConfig.roleMappings);
    if (!this.canUseTaskPermission(actorRoles, interaction, 'task:move')) return;

    const taskId = interaction.options.getString('task', true);
    const toStateKey = interaction.options.getString('to_state', true);
    const reason = interaction.options.getString('reason');

    const task = await this.prisma.task.findFirst({
      where: { guildConfigId: guildConfig.id, id: taskId, archivedAt: null },
      include: { workflowState: true },
    });

    if (!task) {
      await interaction.reply({ ephemeral: true, content: 'Task was not found.' });
      return;
    }

    const targetState = guildConfig.workflowStates.find((state) => state.key === toStateKey);
    if (!targetState) {
      await interaction.reply({ ephemeral: true, content: `Workflow state \`${toStateKey}\` does not exist.` });
      return;
    }

    const transitionCheck = this.workflowService.canTransition(task.workflowState.key, toStateKey, actorRoles, reason ?? undefined);
    if (!transitionCheck.allowed) {
      await interaction.reply({ ephemeral: true, content: transitionCheck.reason ?? 'Transition is not allowed.' });
      return;
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        workflowStateId: targetState.id,
        completedAt: targetState.key === 'done' ? new Date() : null,
        lastReminderAt: null,
        lastReminderType: null,
      },
    });

    await this.prisma.taskTransition.create({
      data: {
        taskId: task.id,
        fromWorkflowStateId: task.workflowStateId,
        toWorkflowStateId: targetState.id,
        movedByDiscordId: interaction.user.id,
        reason,
      },
    });

    await interaction.reply({ ephemeral: true, content: `Moved **${task.title}** from **${task.workflowState.displayName}** to **${targetState.displayName}**.` });
  }

  private async handleViewTask(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    const taskId = interaction.options.getString('task', true);
    const task = await this.prisma.task.findFirst({
      where: { guildConfigId: guildConfig.id, id: taskId },
      include: {
        workflowState: true,
        assignments: { orderBy: { createdAt: 'desc' }, take: 3 },
        transitions: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!task) {
      await interaction.reply({ ephemeral: true, content: 'Task was not found.' });
      return;
    }

    const transitionText = task.transitions.length > 0
      ? task.transitions.map((item) => `• ${item.fromWorkflowStateId} -> ${item.toWorkflowStateId}`).join('\n')
      : 'No transition history';
    const reminderText = task.lastReminderAt && task.lastReminderType
      ? `${task.lastReminderType} at ${task.lastReminderAt.toISOString().slice(0, 16).replace('T', ' ')}`
      : 'No reminder sent';

    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle(task.title)
          .setDescription(task.description)
          .addFields(
            { name: 'Type', value: task.type, inline: true },
            { name: 'State', value: task.workflowState.displayName, inline: true },
            { name: 'Priority', value: task.priority, inline: true },
            { name: 'Assignee', value: task.assigneeDiscordId ? `<@${task.assigneeDiscordId}>` : 'Unassigned', inline: true },
            { name: 'Deadline', value: this.formatDeadlineWithStatus(task.dueDate, task.completedAt), inline: true },
            { name: 'Archived', value: task.archivedAt ? task.archivedAt.toISOString().slice(0, 10) : 'No', inline: true },
            { name: 'Reminder', value: reminderText },
            { name: 'Recent transitions', value: transitionText },
          )
          .setColor(0x1d4ed8),
      ],
    });
  }

  private async handleListTasks(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    const stateFilter = interaction.options.getString('state');
    const tasks = await this.prisma.task.findMany({
      where: {
        guildConfigId: guildConfig.id,
        archivedAt: null,
        workflowState: stateFilter ? { key: stateFilter } : undefined,
      },
      include: { workflowState: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const lines = tasks.length > 0
      ? tasks.map((task) => `• ${task.title} | ${task.workflowState.displayName} | ${task.assigneeDiscordId ? `<@${task.assigneeDiscordId}>` : 'Unassigned'} | ${this.shortDeadline(task.dueDate, task.completedAt)}`)
      : ['• No tasks found'];

    await interaction.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder().setTitle(stateFilter ? `Tasks in ${stateFilter}` : 'Recent tasks').setDescription(lines.join('\n')).setColor(0x475569)],
    });
  }

  private async handleMyTasks(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    const tasks = await this.prisma.task.findMany({
      where: {
        guildConfigId: guildConfig.id,
        assigneeDiscordId: interaction.user.id,
        archivedAt: null,
        workflowState: { key: { not: 'done' } },
      },
      include: { workflowState: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: 20,
    });

    await this.replyWithTaskCollection(interaction, 'My Tasks', tasks);
  }

  private async handleDueToday(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const tasks = await this.prisma.task.findMany({
      where: {
        guildConfigId: guildConfig.id,
        archivedAt: null,
        dueDate: { gte: start, lt: end },
        completedAt: null,
        workflowState: { key: { not: 'done' } },
      },
      include: { workflowState: true },
      orderBy: { dueDate: 'asc' },
    });

    await this.replyWithTaskCollection(interaction, 'Tasks Due Today', tasks);
  }

  private async handleOverdue(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    const now = new Date();
    const tasks = await this.prisma.task.findMany({
      where: {
        guildConfigId: guildConfig.id,
        archivedAt: null,
        dueDate: { lt: now },
        completedAt: null,
        workflowState: { key: { not: 'done' } },
      },
      include: { workflowState: true },
      orderBy: { dueDate: 'asc' },
    });

    await this.replyWithTaskCollection(interaction, 'Overdue Tasks', tasks);
  }

  private async handleDeadline(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;
    const actorRoles = this.resolveActorAppRoles(interaction, guildConfig.roleMappings);
    if (!this.canUseTaskPermission(actorRoles, interaction, 'task:assign')) return;

    const action = interaction.options.getString('action', true);
    const taskId = interaction.options.getString('task', true);
    const task = await this.findTaskOrReply(interaction, guildConfig.id, taskId);
    if (!task) return;

    if (action === 'clear') {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { dueDate: null, lastReminderAt: null, lastReminderType: null },
      });
      await interaction.reply({ ephemeral: true, content: `Deadline cleared for **${task.title}**.` });
      return;
    }

    const dueInput = interaction.options.getString('due_date');
    const parsedDueDate = this.parseDueDate(dueInput);
    if (!parsedDueDate) {
      await interaction.reply({ ephemeral: true, content: 'Missing or invalid `due_date`. Use `YYYY-MM-DD` or a valid ISO date.' });
      return;
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: { dueDate: parsedDueDate, lastReminderAt: null, lastReminderType: null },
    });

    await interaction.reply({ ephemeral: true, content: `Deadline set for **${task.title}**: ${parsedDueDate.toISOString().slice(0, 10)}.` });
  }

  private async handleApproval(interaction: ChatInputCommandInteraction, decision: ApprovalDecisionStatus) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;
    const actorRoles = this.resolveActorAppRoles(interaction, guildConfig.roleMappings);
    if (!this.canUseTaskPermission(actorRoles, interaction, 'task:approve')) return;

    const taskId = interaction.options.getString('task', true);
    const task = await this.prisma.task.findFirst({
      where: { guildConfigId: guildConfig.id, id: taskId, archivedAt: null },
      include: { workflowState: true },
    });

    if (!task) {
      await interaction.reply({ ephemeral: true, content: 'Task was not found.' });
      return;
    }

    const note = interaction.options.getString(decision === 'APPROVED' ? 'note' : 'reason');
    await this.prisma.approvalDecision.create({
      data: { taskId: task.id, actorDiscordId: interaction.user.id, decision, note },
    });

    if (decision === 'APPROVED') {
      const approvedState = guildConfig.workflowStates.find((state) => state.key === 'approved');
      if (approvedState) {
        await this.prisma.task.update({ where: { id: task.id }, data: { workflowStateId: approvedState.id, completedAt: null } });
      }
    } else {
      const reopenedState = guildConfig.workflowStates.find((state) => state.key === 'reopened');
      if (reopenedState) {
        await this.prisma.task.update({ where: { id: task.id }, data: { workflowStateId: reopenedState.id, completedAt: null } });
      }
    }

    await interaction.reply({ ephemeral: true, content: decision === 'APPROVED' ? `Approved **${task.title}**.` : `Rejected **${task.title}** and moved it back for rework.` });
  }

  private async handleBoardView(interaction: ChatInputCommandInteraction) {
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    const tasks = await this.prisma.task.findMany({
      where: { guildConfigId: guildConfig.id, archivedAt: null },
      include: { workflowState: true },
      orderBy: [{ workflowState: { orderIndex: 'asc' } }, { createdAt: 'asc' }],
    });

    const board = guildConfig.boards[0];
    const embed = new EmbedBuilder()
      .setTitle(`${board?.name ?? 'Default'} Kanban Board`)
      .setDescription(`All non-archived tasks grouped by workflow state. Total tasks: ${tasks.length}`)
      .setColor(0x2b6cb0);

    for (const state of guildConfig.workflowStates) {
      const stateTasks = tasks.filter((task) => task.workflowStateId === state.id);
      const lines = stateTasks.length > 0
        ? stateTasks.slice(0, 8).map((task) => {
            const assignee = task.assigneeDiscordId ? `<@${task.assigneeDiscordId}>` : 'Unassigned';
            return `• ${task.title} | ${assignee} | ${this.shortDeadline(task.dueDate, task.completedAt)}`;
          })
        : ['No tasks'];

      const remaining = stateTasks.length > 8 ? `\n...and ${stateTasks.length - 8} more` : '';
      embed.addFields({ name: `${state.displayName} (${stateTasks.length})`, value: `${lines.join('\n')}${remaining}`.slice(0, 1024) });
    }

    await interaction.reply({ ephemeral: true, embeds: [embed] });
  }

  private async handleWorkflowView(interaction: ChatInputCommandInteraction) {
    const lines = this.workflowService.getDefaultTransitions().map((transition) => {
      const roles = transition.allowedRoles.join(', ');
      const suffix = transition.requiresReason ? ' | reason required' : '';
      return `• ${transition.from} -> ${transition.to} | ${roles}${suffix}`;
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Workflow Rules')
          .setDescription('Default configured state transitions')
          .addFields({ name: 'Transitions', value: lines.join('\n') })
          .setColor(0x805ad5),
      ],
      ephemeral: true,
    });
  }

  private async handleSettingsView(interaction: ChatInputCommandInteraction) {
    const hasAccess = await this.assertAdminAccess(interaction);
    if (!hasAccess) return;

    const action = interaction.options.getString('action', true);
    if (action === 'set_notification_channel') {
      const channel = interaction.options.getChannel('notification_channel');
      if (!channel) {
        await interaction.reply({ ephemeral: true, content: 'Missing `notification_channel`. Use `/admin settings action:Set notification channel notification_channel:#channel`.' });
        return;
      }

      const guildConfig = await this.getGuildConfig(interaction);
      if (!guildConfig) return;
      await this.prisma.guildConfig.update({ where: { id: guildConfig.id }, data: { notificationChannelId: channel.id } });
      await interaction.reply({ ephemeral: true, content: `Notification channel set to ${channel}.` });
      return;
    }

    if (action === 'clear_notification_channel') {
      const guildConfig = await this.getGuildConfig(interaction);
      if (!guildConfig) return;
      await this.prisma.guildConfig.update({ where: { id: guildConfig.id }, data: { notificationChannelId: null } });
      await interaction.reply({ ephemeral: true, content: 'Notification channel cleared.' });
      return;
    }

    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    const board = guildConfig.boards[0];
    const notificationLines = guildConfig.notificationRules.length > 0
      ? guildConfig.notificationRules.map((rule) => {
          const status = rule.isEnabled ? 'enabled' : 'disabled';
          const channel = rule.channelId ? `<#${rule.channelId}>` : 'not set';
          return `• ${rule.eventKey}: ${status} | channel: ${channel}`;
        })
      : ['• No notification rules configured'];

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Admin Settings')
          .setDescription(`Current server configuration for ${guildConfig.name}`)
          .addFields(
            { name: 'Workspace', value: `Guild ID: ${guildConfig.discordGuildId}` },
            { name: 'Board', value: board ? `${board.name} (${board.key})` : 'No default board configured', inline: true },
            { name: 'Notification Channel', value: guildConfig.notificationChannelId ? `<#${guildConfig.notificationChannelId}>` : 'Not set', inline: true },
            { name: 'Counts', value: `States: ${guildConfig.workflowStates.length}\nTransitions: ${guildConfig.workflowTransitions.length}\nRole mappings: ${guildConfig.roleMappings.length}`, inline: true },
            { name: 'Notification Rules', value: notificationLines.join('\n') },
          )
          .setColor(0x0f766e),
      ],
      ephemeral: true,
    });
  }

  private async handleRolesView(interaction: ChatInputCommandInteraction) {
    const hasAccess = await this.assertAdminAccess(interaction);
    if (!hasAccess) return;

    const action = interaction.options.getString('action', true);
    const guildConfig = await this.getGuildConfig(interaction);
    if (!guildConfig) return;

    if (action === 'set') {
      const discordRole = interaction.options.getRole('discord_role');
      const appRole = interaction.options.getString('app_role') as AppRole | null;
      if (!discordRole || !appRole) {
        await interaction.reply({ ephemeral: true, content: 'Missing data. Use `/admin roles action:Map role to permission discord_role:@Lead app_role:LEAD`.' });
        return;
      }

      await this.prisma.roleMapping.upsert({
        where: {
          guildConfigId_discordRoleId_appRole: {
            guildConfigId: guildConfig.id,
            discordRoleId: discordRole.id,
            appRole,
          },
        },
        update: {},
        create: {
          guildConfigId: guildConfig.id,
          discordRoleId: discordRole.id,
          appRole,
        },
      });

      await interaction.reply({ ephemeral: true, content: `Mapped ${discordRole} to bot permission ${appRole}.` });
      return;
    }

    if (action === 'remove') {
      const discordRole = interaction.options.getRole('discord_role');
      const appRole = interaction.options.getString('app_role') as AppRole | null;
      if (!discordRole || !appRole) {
        await interaction.reply({ ephemeral: true, content: 'Missing data. Use `/admin roles action:Remove role mapping discord_role:@Lead app_role:LEAD`.' });
        return;
      }

      await this.prisma.roleMapping.deleteMany({
        where: {
          guildConfigId: guildConfig.id,
          discordRoleId: discordRole.id,
          appRole,
        },
      });

      await interaction.reply({ ephemeral: true, content: `Removed mapping ${discordRole} -> ${appRole}.` });
      return;
    }

    const mappingLines = guildConfig.roleMappings.length > 0
      ? guildConfig.roleMappings.map((mapping) => `• <@&${mapping.discordRoleId}> -> ${mapping.appRole}`)
      : Object.entries(this.settingsService.getDefaultRoleMapping()).map(([roleName, appRoles]) => `• ${roleName} -> ${appRoles.join(', ')}`);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Role Permission Mapping')
          .setDescription(guildConfig.roleMappings.length > 0 ? 'These Discord roles currently control bot permissions.' : 'No role mapping saved yet. Suggested permission roles are shown below.')
          .addFields({ name: 'Mappings', value: mappingLines.join('\n') })
          .setColor(0xb7791f),
      ],
      ephemeral: true,
    });
  }

  private async getGuildConfig(interaction: ChatInputCommandInteraction): Promise<GuildConfigWithRelations | null> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ ephemeral: true, content: 'This command can only be used inside a Discord server.' });
      return null;
    }

    const guildConfig = await this.prisma.guildConfig.findUnique({
      where: { discordGuildId: guildId },
      include: {
        boards: true,
        workflowStates: { orderBy: { orderIndex: 'asc' } },
        workflowTransitions: true,
        roleMappings: true,
        notificationRules: true,
      },
    });

    if (!guildConfig) {
      await interaction.reply({ ephemeral: true, content: 'No guild configuration found for this server. Run `npm run prisma:seed` and retry.' });
      return null;
    }

    return guildConfig;
  }

  private async findTaskOrReply(interaction: ChatInputCommandInteraction, guildConfigId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { guildConfigId, id: taskId },
    });

    if (!task) {
      await interaction.reply({ ephemeral: true, content: 'Task was not found.' });
      return null;
    }

    return task;
  }

  private async replyWithTaskCollection(
    interaction: ChatInputCommandInteraction,
    title: string,
    tasks: Array<{
      externalKey: string;
      title: string;
      assigneeDiscordId: string | null;
      dueDate: Date | null;
      completedAt: Date | null;
      workflowState: { displayName: string };
    }>,
  ) {
    const lines = tasks.length > 0
      ? tasks.map((task) => `• ${task.title} | ${task.workflowState.displayName} | ${task.assigneeDiscordId ? `<@${task.assigneeDiscordId}>` : 'Unassigned'} | ${this.shortDeadline(task.dueDate, task.completedAt)}`)
      : ['• No tasks found'];

    await interaction.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder().setTitle(title).setDescription(lines.join('\n')).setColor(0x7c3aed)],
    });
  }

  private resolveActorAppRoles(interaction: ChatInputCommandInteraction, roleMappings: { discordRoleId: string; appRole: AppRole }[]): AppRole[] {
    const mapping: Record<string, AppRole[]> = {};
    for (const item of roleMappings) {
      mapping[item.discordRoleId] ??= [];
      mapping[item.discordRoleId].push(item.appRole);
    }

    const roleIds = this.getInteractionRoleIds(interaction);
    return this.permissionService.resolveAppRoles(roleIds, mapping);
  }

  private getInteractionRoleIds(interaction: ChatInputCommandInteraction): string[] {
    const member = interaction.member;
    if (!member) return [];

    const guildMember = interaction.guild?.members.cache.get(interaction.user.id);
    if (guildMember?.roles instanceof GuildMemberRoleManager) {
      return [...guildMember.roles.cache.keys()];
    }

    const apiRoles = (member as { roles?: string[] }).roles;
    return Array.isArray(apiRoles) ? apiRoles : [];
  }

  private canUseTaskPermission(actorRoles: AppRole[], interaction: ChatInputCommandInteraction, permission: TaskPermission) {
    if (this.permissionService.hasPermission(actorRoles, permission)) return true;

    const hasAdminPermission =
      interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

    if (hasAdminPermission) return true;

    void interaction.reply({
      ephemeral: true,
      content: 'You do not have the bot permission required for this action. Ask a server admin to map your Discord role with `/admin roles`.',
    });
    return false;
  }

  private parseDueDate(input: string | null) {
    if (!input) return null;
    const trimmed = input.trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? new Date(`${trimmed}T23:59:59`) : new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private parseLabels(input: string | null) {
    if (input === null) return Prisma.JsonNull;
    const labels = input.split(',').map((label) => label.trim()).filter(Boolean);
    return labels;
  }

  private formatDueDate(dueDate: Date | null) {
    return dueDate ? dueDate.toISOString().slice(0, 10) : 'No deadline';
  }

  private formatDeadlineWithStatus(dueDate: Date | null, completedAt: Date | null) {
    if (!dueDate) return 'No deadline';
    if (completedAt) return `${dueDate.toISOString().slice(0, 10)} | completed`;

    const now = new Date();
    if (dueDate.getTime() < now.getTime()) {
      const days = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));
      return `${dueDate.toISOString().slice(0, 10)} | overdue by ${days} day(s)`;
    }

    const hours = Math.ceil((dueDate.getTime() - now.getTime()) / (60 * 60 * 1000));
    if (hours <= 24) return `${dueDate.toISOString().slice(0, 10)} | due soon`;
    return dueDate.toISOString().slice(0, 10);
  }

  private shortDeadline(dueDate: Date | null, completedAt: Date | null) {
    if (!dueDate) return 'No deadline';
    if (completedAt) return `Done ${dueDate.toISOString().slice(0, 10)}`;
    const now = new Date();
    if (dueDate.getTime() < now.getTime()) return 'Overdue';
    const hours = Math.ceil((dueDate.getTime() - now.getTime()) / (60 * 60 * 1000));
    if (hours <= 24) return 'Due soon';
    return dueDate.toISOString().slice(0, 10);
  }

  private async assertAdminAccess(interaction: ChatInputCommandInteraction) {
    const isOwner = interaction.guild?.ownerId === interaction.user.id;
    const hasAdminPermission =
      interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

    if (isOwner || hasAdminPermission) return true;

    await interaction.reply({
      ephemeral: true,
      content: 'Only the server owner or users with the Administrator permission can use `/admin` commands.',
    });

    return false;
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }
}
