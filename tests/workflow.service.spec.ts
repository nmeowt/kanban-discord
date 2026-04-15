import { describe, expect, it } from 'vitest';
import { WorkflowService } from '../src/modules/tasks/workflow.service';

describe('WorkflowService', () => {
  const service = new WorkflowService();

  it('allows a developer to move in_progress to fixed', () => {
    const result = service.canTransition('in_progress', 'fixed', ['DEVELOPER']);
    expect(result.allowed).toBe(true);
  });

  it('rejects reopen without reason', () => {
    const result = service.canTransition('testing', 'reopened', ['TESTER']);
    expect(result.allowed).toBe(false);
  });
});
