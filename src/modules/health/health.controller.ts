import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'kanban-discord-bot',
      timestamp: new Date().toISOString(),
    };
  }
}
