import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ReminderType } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { REST, Routes } from 'discord.js';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      this.logger.warn('REDIS_URL missing. Jobs bootstrap skipped.');
      return;
    }

    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    const queue = new Queue('task-events', { connection });
    await queue.add(
      'daily-digest',
      { type: 'daily-digest' },
      {
        repeat: { pattern: '0 9 * * *' },
        jobId: 'daily-digest',
      },
    );

    await queue.add(
      'deadline-reminders',
      { type: 'deadline-reminders' },
      {
        repeat: { pattern: '*/30 * * * *' },
        jobId: 'deadline-reminders',
      },
    );

    const worker = new Worker(
      'task-events',
      async (job) => {
        if (job.name === 'deadline-reminders') {
          await this.processDeadlineReminders();
        }
      },
      { connection },
    );

    worker.on('error', (error) => {
      this.logger.error(`Background worker error: ${error.message}`);
    });

    this.logger.log('Background job queue initialized.');
  }

  private async processDeadlineReminders() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      return;
    }

    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: { not: null, lte: soonThreshold },
        completedAt: null,
        archivedAt: null,
        workflowState: {
          key: { not: 'done' },
        },
      },
      include: {
        guildConfig: true,
        workflowState: true,
      },
    });

    const rest = new REST({ version: '10' }).setToken(token);

    for (const task of tasks) {
      if (!task.dueDate) {
        continue;
      }

      const reminderType = task.dueDate.getTime() < now.getTime() ? ReminderType.OVERDUE : ReminderType.DUE_SOON;
      if (this.shouldSkipReminder(task.lastReminderAt, task.lastReminderType, reminderType, now)) {
        continue;
      }

      const channelId = task.guildConfig.notificationChannelId;
      if (!channelId) {
        continue;
      }

      const mention = task.assigneeDiscordId ? `<@${task.assigneeDiscordId}> ` : '';
      const deadlineText =
        reminderType === ReminderType.OVERDUE
          ? `is overdue since ${task.dueDate.toISOString().slice(0, 10)}`
          : `is due by ${task.dueDate.toISOString().slice(0, 10)}`;

      await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: `${mention}Task **${task.externalKey}** (${task.title}) ${deadlineText}. Current state: **${task.workflowState.displayName}**.`,
        },
      });

      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          lastReminderAt: now,
          lastReminderType: reminderType,
        },
      });
    }
  }

  private shouldSkipReminder(
    lastReminderAt: Date | null,
    lastReminderType: ReminderType | null,
    nextType: ReminderType,
    now: Date,
  ) {
    if (!lastReminderAt || !lastReminderType) {
      return false;
    }

    const elapsed = now.getTime() - lastReminderAt.getTime();

    if (nextType === ReminderType.DUE_SOON) {
      return lastReminderType === ReminderType.DUE_SOON && elapsed < 12 * 60 * 60 * 1000;
    }

    return lastReminderType === ReminderType.OVERDUE && elapsed < 24 * 60 * 60 * 1000;
  }
}
