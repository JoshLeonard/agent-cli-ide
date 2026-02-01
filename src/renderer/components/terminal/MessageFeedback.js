import React from 'react';
import { useMessagingStore } from '../../stores/messagingStore';
import './MessageFeedback.css';
export const MessageFeedback = ({ sessionId }) => {
    const { lastReceivedMessage, lastSentMessage } = useMessagingStore();
    const isReceived = lastReceivedMessage?.sessionId === sessionId;
    const isSent = lastSentMessage?.sessionId === sessionId;
    if (!isReceived && !isSent)
        return null;
    return (<div className={`message-feedback ${isReceived ? 'received' : 'sent'}`}>
      <div className="feedback-content">
        {isReceived ? (<>
            <span className="feedback-icon">\u2193</span>
            <span className="feedback-text">Message received</span>
          </>) : (<>
            <span className="feedback-icon">\u2191</span>
            <span className="feedback-text">Message sent</span>
          </>)}
      </div>
    </div>);
};
//# sourceMappingURL=MessageFeedback.js.map