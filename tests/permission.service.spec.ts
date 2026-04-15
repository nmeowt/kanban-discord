import { describe, expect, it } from 'vitest';
import { PermissionService } from '../src/modules/tasks/permission.service';

describe('PermissionService', () => {
  const service = new PermissionService();

  it('maps Discord roles into app roles', () => {
    const result = service.resolveAppRoles(['role-dev', 'role-lead'], {
      'role-dev': ['DEVELOPER'],
      'role-lead': ['LEAD'],
    });

    expect(result.sort()).toEqual(['DEVELOPER', 'LEAD']);
  });

  it('allows lead assignment', () => {
    expect(service.hasPermission(['LEAD'], 'task:assign')).toBe(true);
  });
});
