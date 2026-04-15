import { Injectable } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AssignmentService } from './assignment.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { ApprovalRequest, MoveTaskRequest, TaskDraft } from './task.types';
import { WorkflowService } from './workflow.service';

@Injectable()
export class TaskService {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly permissionService: PermissionService,
    private readonly assignmentService: AssignmentService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
  ) {}

  createTask(input: TaskDraft) {
    this.auditLogService.record({
      event: 'task.created',
      guildId: input.guildId,
      actorDiscordId: input.createdByDiscordId,
      resourceId: input.title,
      metadata: input,
    });

    return {
      taskKey: `${input.boardKey}-${Date.now()}`,
      status: 'backlog',
      ...input,
    };
  }

  assignTask(actorRoles: string[], assigneeDiscordId?: string) {
    this.assignmentService.validateAssignment(actorRoles as never[], assigneeDiscordId);
    return {
      ok: true,
      assigneeDiscordId,
    };
  }

  moveTask(input: MoveTaskRequest) {
    const permissionOk = this.permissionService.hasPermission(input.actorRoles, 'task:move');

    if (!permissionOk) {
      return {
        ok: false,
        error: 'Actor lacks task:move permission.',
      };
    }

    const transition = this.workflowService.canTransition(
      input.fromState,
      input.toState,
      input.actorRoles,
      input.reason,
    );

    if (!transition.allowed) {
      return {
        ok: false,
        error: transition.reason,
      };
    }

    this.auditLogService.record({
      event: 'task.moved',
      guildId: 'unknown',
      actorDiscordId: input.actorDiscordId,
      resourceId: input.taskKey,
      metadata: input,
    });

    void this.notificationService.notify('task.moved', input);

    return {
      ok: true,
      nextState: input.toState,
    };
  }

  approveTask(input: ApprovalRequest) {
    const permissionOk = this.permissionService.hasPermission(input.actorRoles, 'task:approve');

    if (!permissionOk) {
      return {
        ok: false,
        error: 'Actor lacks task:approve permission.',
      };
    }

    this.auditLogService.record({
      event: `task.${input.decision.toLowerCase()}`,
      guildId: 'unknown',
      actorDiscordId: input.actorDiscordId,
      resourceId: input.taskKey,
      metadata: input,
    });

    return {
      ok: true,
      decision: input.decision,
    };
  }
}
