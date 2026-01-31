export type AgentCategory = 'ai-agent' | 'shell' | 'custom';

export interface AgentConfig {
  id: string;              // e.g., "claude-code", "powershell"
  name: string;            // Display name
  description?: string;
  command: string;         // Executable (e.g., "claude", "cursor")
  args?: string[];         // Default args
  icon?: string;           // Emoji for UI
  category: AgentCategory;
  available?: boolean;     // Discovered at runtime
}
