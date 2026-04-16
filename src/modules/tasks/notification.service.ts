import { Injectable, Logger } from '@nestjs/common';
import { REST, Routes } from 'discord.js';
import { PrismaService } from '../prisma/prisma.service';

interface TaskAssignedNotificationPayload {
  guildConfigId: string;
  taskExternalKey: string;
  taskTitle: string;
  assignedByDiscordId: string;
  assigneeDiscordId: string;
  previousAssigneeDiscordId?: string | null;
  dueDate?: Date | null;
  note?: string | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(eventKey: string, payload: unknown) {
    if (eventKey === 'task.assigned') {
      await this.notifyTaskAssigned(payload as TaskAssignedNotificationPayload);
      return;
    }

    this.logger.log(`Queued notification ${eventKey}: ${JSON.stringify(payload)}`);
  }

  private async notifyTaskAssigned(payload: TaskAssignedNotificationPayload) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      this.logger.warn('DISCORD_BOT_TOKEN missing. Assignment notification skipped.');
      return;
    }

    const guildConfig = await this.prisma.guildConfig.findUnique({
      where: { id: payload.guildConfigId },
      include: { notificationRules: true },
    });

    if (!guildConfig) {
      this.logger.warn(`Guild config ${payload.guildConfigId} not found. Assignment notification skipped.`);
      return;
    }

    const rule = guildConfig.notificationRules.find((item) => item.eventKey === 'task.assigned');
    if (rule && !rule.isEnabled) {
      return;
    }

    const channelId = rule?.channelId ?? guildConfig.notificationChannelId;
    if (!channelId) {
      this.logger.log(`Assignment notification skipped for ${payload.taskExternalKey}. No notification channel configured.`);
      return;
    }

    const roleMention = rule?.mentionRoleId ? `<@&${rule.mentionRoleId}> ` : '';
    const dueDate = payload.dueDate ? ` Due: ${payload.dueDate.toISOString().slice(0, 10)}.` : '';
    const reassignedFrom = payload.previousAssigneeDiscordId && payload.previousAssigneeDiscordId !== payload.assigneeDiscordId
      ? ` Reassigned from <@${payload.previousAssigneeDiscordId}>.`
      : '';
    const note = payload.note ? ` Note: ${payload.note}` : '';
    const content =
      `${roleMention}<@${payload.assigneeDiscordId}> you were assigned ` +
      `**${payload.taskExternalKey}** (${payload.taskTitle}) by <@${payload.assignedByDiscordId}>.` +
      `${reassignedFrom}${dueDate}${note}`;

    try {
      const rest = new REST({ version: '10' }).setToken(token);
      await rest.post(Routes.channelMessages(channelId), {
        body: { content },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send assignment notification for ${payload.taskExternalKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
