import { describe, expect, it } from 'vitest';
import { AssignmentService } from '../src/modules/tasks/assignment.service';

describe('AssignmentService', () => {
  const service = new AssignmentService();

  it('allows lead assignment', () => {
    expect(() => service.validateAssignment(['LEAD'], '123')).not.toThrow();
  });

  it('rejects developer assignment', () => {
    expect(() => service.validateAssignment(['DEVELOPER'], '123')).toThrow();
  });
});
