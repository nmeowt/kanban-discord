import { WorkflowState, WorkflowTransitionRule } from './task.types';

export const DEFAULT_WORKFLOW_STATES: WorkflowState[] = [
  { key: 'backlog', displayName: 'Backlog', category: 'BACKLOG', orderIndex: 0 },
  { key: 'todo', displayName: 'Todo', category: 'BACKLOG', orderIndex: 1 },
  { key: 'in_progress', displayName: 'In Progress', category: 'ACTIVE', orderIndex: 2 },
  { key: 'fixed', displayName: 'Fixed', category: 'REVIEW', orderIndex: 3 },
  { key: 'testing', displayName: 'Testing', category: 'REVIEW', orderIndex: 4 },
  { key: 'approved', displayName: 'Approved', category: 'DONE', orderIndex: 5 },
  { key: 'done', displayName: 'Done', category: 'DONE', orderIndex: 6 },
  { key: 'reopened', displayName: 'Reopened', category: 'ACTIVE', orderIndex: 7, allowReopen: true },
];

export const DEFAULT_TRANSITIONS: WorkflowTransitionRule[] = [
  { from: 'backlog', to: 'todo', allowedRoles: ['ADMIN', 'LEAD'] },
  { from: 'todo', to: 'in_progress', allowedRoles: ['ADMIN', 'LEAD', 'DEVELOPER'] },
  { from: 'in_progress', to: 'fixed', allowedRoles: ['ADMIN', 'DEVELOPER'] },
  { from: 'fixed', to: 'testing', allowedRoles: ['ADMIN', 'LEAD', 'TESTER'] },
  { from: 'testing', to: 'approved', allowedRoles: ['ADMIN', 'LEAD', 'TESTER', 'APPROVER'] },
  { from: 'testing', to: 'reopened', allowedRoles: ['ADMIN', 'LEAD', 'TESTER', 'APPROVER'], requiresReason: true },
  { from: 'approved', to: 'done', allowedRoles: ['ADMIN', 'LEAD', 'APPROVER'] },
  { from: 'reopened', to: 'in_progress', allowedRoles: ['ADMIN', 'LEAD', 'DEVELOPER'] },
];
