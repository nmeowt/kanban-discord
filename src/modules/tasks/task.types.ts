export type AppRole = 'ADMIN' | 'LEAD' | 'DEVELOPER' | 'TESTER' | 'APPROVER';

export type TaskType = 'TASK' | 'BUG';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface WorkflowState {
  key: string;
  displayName: string;
  category: 'BACKLOG' | 'ACTIVE' | 'REVIEW' | 'DONE';
  orderIndex: number;
  allowReopen?: boolean;
}

export interface WorkflowTransitionRule {
  from: string;
  to: string;
  allowedRoles: AppRole[];
  requiresReason?: boolean;
}

export interface TaskDraft {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  guildId: string;
  boardKey: string;
  createdByDiscordId: string;
  assigneeDiscordId?: string;
  dueDate?: string;
  labels?: string[];
}

export interface MoveTaskRequest {
  taskKey: string;
  fromState: string;
  toState: string;
  actorDiscordId: string;
  actorRoles: AppRole[];
  reason?: string;
}

export interface ApprovalRequest {
  taskKey: string;
  actorDiscordId: string;
  actorRoles: AppRole[];
  decision: 'APPROVED' | 'REJECTED';
  note?: string;
}

export interface GuildRoleMapping {
  [discordRoleId: string]: AppRole[];
}
