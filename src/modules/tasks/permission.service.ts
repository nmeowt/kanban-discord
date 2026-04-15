import { Injectable } from '@nestjs/common';
import { AppRole, GuildRoleMapping } from './task.types';

type Permission =
  | 'task:create'
  | 'task:assign'
  | 'task:move'
  | 'task:approve'
  | 'task:admin';

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  ADMIN: ['task:create', 'task:assign', 'task:move', 'task:approve', 'task:admin'],
  LEAD: ['task:create', 'task:assign', 'task:move', 'task:approve'],
  DEVELOPER: ['task:create', 'task:move'],
  TESTER: ['task:create', 'task:move', 'task:approve'],
  APPROVER: ['task:approve'],
};

@Injectable()
export class PermissionService {
  resolveAppRoles(memberRoleIds: string[], mapping: GuildRoleMapping): AppRole[] {
    const resolved = new Set<AppRole>();

    for (const roleId of memberRoleIds) {
      for (const appRole of mapping[roleId] ?? []) {
        resolved.add(appRole);
      }
    }

    return [...resolved];
  }

  hasPermission(actorRoles: AppRole[], permission: Permission): boolean {
    return actorRoles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
  }
}
