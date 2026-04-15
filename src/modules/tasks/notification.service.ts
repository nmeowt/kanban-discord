import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async notify(eventKey: string, payload: unknown) {
    this.logger.log(`Queued notification ${eventKey}: ${JSON.stringify(payload)}`);
  }
}
