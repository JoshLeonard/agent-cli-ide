import { v4 as uuidv4 } from 'uuid';
import { eventBus, Events } from './EventBus';
import { sessionRegistry } from './SessionRegistry';
import { agentStatusTracker } from './AgentStatusTracker';
import type { InterSessionMessage, SharedClipboard, MessageSendOptions } from '../../shared/types/messaging';

export class MessagingService {
  private sharedClipboard: SharedClipboard | null = null;

  send(
    sourceSessionId: string,
    targetSessionIds: string[],
    content: string,
    options?: MessageSendOptions
  ): { success: boolean; messageId?: string; error?: string } {
    if (!content) {
      return { success: false, error: 'Content cannot be empty' };
    }

    if (targetSessionIds.length === 0) {
      return { success: false, error: 'No target sessions specified' };
    }

    const messageId = uuidv4();
    const message: InterSessionMessage = {
      id: messageId,
      type: options?.type || 'text',
      sourceSessionId,
      targetSessionIds,
      content,
      timestamp: Date.now(),
      metadata: {
        addNewline: options?.addNewline ?? true,
        delay: options?.delay,
      },
    };

    // Send to each target session
    const successfulTargets: string[] = [];
    const failedTargets: string[] = [];

    for (const targetId of targetSessionIds) {
      const session = sessionRegistry.getSession(targetId);
      if (!session || session.status !== 'running') {
        failedTargets.push(targetId);
        continue;
      }

      // Write to the session's PTY
      const dataToWrite = message.metadata?.addNewline
        ? content + '\r'
        : content;

      if (message.metadata?.delay) {
        // Delayed write
        setTimeout(() => {
          session.write(dataToWrite);
          // Set to working if executing a command
          if (message.metadata?.addNewline) {
            agentStatusTracker.setActivityState(targetId, 'working');
          }
        }, message.metadata.delay);
      } else {
        session.write(dataToWrite);
        // Set to working if executing a command
        if (message.metadata?.addNewline) {
          agentStatusTracker.setActivityState(targetId, 'working');
        }
      }

      successfulTargets.push(targetId);

      // Emit received event for the target
      eventBus.emit(Events.MESSAGE_RECEIVED, { message, targetSessionId: targetId });
    }

    // Emit sent event for the source
    eventBus.emit(Events.MESSAGE_SENT, { message });

    if (failedTargets.length > 0 && successfulTargets.length === 0) {
      return { success: false, error: 'All target sessions unavailable' };
    }

    return { success: true, messageId };
  }

  broadcast(
    sourceSessionId: string,
    content: string,
    options?: MessageSendOptions,
    excludeSessionId?: string
  ): { success: boolean; messageId?: string; targetCount?: number; error?: string } {
    // Get all running sessions
    const sessions = sessionRegistry.listSessions();
    const targetSessionIds = sessions
      .filter(s => s.status === 'running')
      .filter(s => s.id !== sourceSessionId)
      .filter(s => !excludeSessionId || s.id !== excludeSessionId)
      .map(s => s.id);

    if (targetSessionIds.length === 0) {
      return { success: false, error: 'No running sessions to broadcast to' };
    }

    const result = this.send(sourceSessionId, targetSessionIds, content, options);
    return {
      ...result,
      targetCount: targetSessionIds.length,
    };
  }

  setClipboard(content: string, sourceSessionId: string): { success: boolean } {
    this.sharedClipboard = {
      content,
      sourceSessionId,
      timestamp: Date.now(),
    };
    return { success: true };
  }

  getClipboard(): SharedClipboard | null {
    return this.sharedClipboard;
  }

  clearClipboard(): void {
    this.sharedClipboard = null;
  }
}

// Singleton instance
export const messagingService = new MessagingService();
