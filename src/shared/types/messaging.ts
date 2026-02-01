export type MessageType = 'text' | 'command' | 'output';

export interface InterSessionMessage {
  id: string;
  type: MessageType;
  sourceSessionId: string;
  targetSessionIds: string[];
  content: string;
  timestamp: number;
  metadata?: {
    addNewline?: boolean;
    delay?: number;
  };
}

export interface SharedClipboard {
  content: string;
  sourceSessionId: string;
  timestamp: number;
}

export interface MessageSendOptions {
  type?: MessageType;
  addNewline?: boolean;
  delay?: number;
}
