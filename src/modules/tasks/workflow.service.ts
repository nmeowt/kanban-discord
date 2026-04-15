import { Injectable } from '@nestjs/common';
import { DEFAULT_TRANSITIONS, DEFAULT_WORKFLOW_STATES } from './workflow.defaults';
import { AppRole, WorkflowState, WorkflowTransitionRule } from './task.types';

@Injectable()
export class WorkflowService {
  getDefaultStates(): WorkflowState[] {
    return DEFAULT_WORKFLOW_STATES;
  }

  getDefaultTransitions(): WorkflowTransitionRule[] {
    return DEFAULT_TRANSITIONS;
  }

  canTransition(from: string, to: string, actorRoles: AppRole[], reason?: string) {
    const match = DEFAULT_TRANSITIONS.find((transition) => transition.from === from && transition.to === to);

    if (!match) {
      return {
        allowed: false,
        reason: `Transition ${from} -> ${to} is not configured.`,
      };
    }

    if (!actorRoles.some((role) => match.allowedRoles.includes(role))) {
      return {
        allowed: false,
        reason: `Actor roles ${actorRoles.join(', ')} cannot move a task to ${to}.`,
      };
    }

    if (match.requiresReason && !reason?.trim()) {
      return {
        allowed: false,
        reason: `Transition ${from} -> ${to} requires a reason.`,
      };
    }

    return {
      allowed: true,
      reason: null,
    };
  }
}
