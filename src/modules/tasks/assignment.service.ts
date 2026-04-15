import { BadRequestException, Injectable } from '@nestjs/common';
import { AppRole } from './task.types';

@Injectable()
export class AssignmentService {
  validateAssignment(actorRoles: AppRole[], assigneeDiscordId?: string) {
    if (!assigneeDiscordId) {
      throw new BadRequestException('An assignee is required.');
    }

    if (!actorRoles.some((role) => ['ADMIN', 'LEAD'].includes(role))) {
      throw new BadRequestException('Only Admin or Lead can assign tasks.');
    }
  }
}
