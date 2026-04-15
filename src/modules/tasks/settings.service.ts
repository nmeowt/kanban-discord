import { Injectable } from '@nestjs/common';
import { GuildRoleMapping } from './task.types';

@Injectable()
export class SettingsService {
  getDefaultRoleMapping(): GuildRoleMapping {
    return {
      admin: ['ADMIN'],
      lead: ['LEAD'],
      developer: ['DEVELOPER'],
      tester: ['TESTER'],
      approver: ['APPROVER'],
    };
  }
}
