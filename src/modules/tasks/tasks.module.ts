import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { SettingsService } from './settings.service';
import { TaskService } from './task.service';
import { WorkflowService } from './workflow.service';

@Module({
  providers: [
    AssignmentService,
    AuditLogService,
    NotificationService,
    PermissionService,
    SettingsService,
    TaskService,
    WorkflowService,
  ],
  exports: [
    AssignmentService,
    AuditLogService,
    NotificationService,
    PermissionService,
    SettingsService,
    TaskService,
    WorkflowService,
  ],
})
export class TasksModule {}
