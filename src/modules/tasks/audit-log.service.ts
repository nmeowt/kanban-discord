import { Injectable, Logger } from '@nestjs/common';

export interface AuditEvent {
  event: string;
  guildId: string;
  actorDiscordId: string;
  resourceId: string;
  metadata?: unknown;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  record(event: AuditEvent) {
    this.logger.log(JSON.stringify(event));
  }
}
