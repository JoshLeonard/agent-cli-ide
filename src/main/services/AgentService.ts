import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { AgentConfig } from '../../shared/types/agent';

const execAsync = promisify(exec);

const BUILT_IN_AGENTS: AgentConfig[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'AI coding assistant by Anthropic',
    command: 'claude',
    icon: '🤖',
    category: 'ai-agent',
  },
  {
    id: 'cursor',
    name: 'Cursor CLI',
    description: 'AI-powered code editor CLI',
    command: 'agent',
    icon: '⚡',
    category: 'ai-agent',
  },
  {
    id: 'aider',
    name: 'Aider',
    description: 'AI pair programming in your terminal',
    command: 'aider',
    icon: '🔧',
    category: 'ai-agent',
  },
  {
    id: 'powershell',
    name: 'PowerShell',
    description: 'Windows PowerShell',
    command: process.platform === 'win32'
      ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'pwsh',
    args: ['-NoLogo'],
    icon: '💠',
    category: 'shell',
  },
  {
    id: 'bash',
    name: 'Bash',
    description: 'Bourne Again Shell',
    command: process.platform === 'win32' ? 'bash' : '/bin/bash',
    args: ['--login'],
    icon: '🐚',
    category: 'shell',
  },
  {
    id: 'cmd',
    name: 'Command Prompt',
    description: 'Windows Command Prompt',
    command: 'cmd.exe',
    icon: '📟',
    category: 'shell',
  },
];

export class AgentService {
  private agents: Map<string, AgentConfig> = new Map();
  private customConfigPath: string;
  private initialized = false;

  constructor() {
    this.customConfigPath = path.join(app.getPath('userData'), 'agents.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load built-in agents
    for (const agent of BUILT_IN_AGENTS) {
      this.agents.set(agent.id, { ...agent });
    }

    // Load custom agents from config
    await this.loadCustomAgents();

    // Discover available agents
    await this.discoverAgents();

    this.initialized = true;
  }

  private async loadCustomAgents(): Promise<void> {
    try {
      if (fs.existsSync(this.customConfigPath)) {
        const content = fs.readFileSync(this.customConfigPath, 'utf-8');
        const customAgents: AgentConfig[] = JSON.parse(content);
        for (const agent of customAgents) {
          // Custom agents override built-in if same ID
          this.agents.set(agent.id, { ...agent, category: 'custom' });
        }
      }
    } catch (error) {
      console.error('Failed to load custom agents:', error);
    }
  }

  async discoverAgents(): Promise<void> {
    const discoveryPromises = Array.from(this.agents.values()).map(async (agent) => {
      const available = await this.checkCommandAvailable(agent.command);
      agent.available = available;
    });

    await Promise.all(discoveryPromises);
  }

  private async checkCommandAvailable(command: string): Promise<boolean> {
    // If it's an absolute path, check if file exists
    if (path.isAbsolute(command)) {
      return fs.existsSync(command);
    }

    // Otherwise, use where (Windows) or which (Unix) to check PATH
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';

    try {
      await execAsync(`${checkCommand} ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  getAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  getAvailableAgents(): AgentConfig[] {
    return Array.from(this.agents.values()).filter((agent) => agent.available);
  }

  getAgent(id: string): AgentConfig | undefined {
    return this.agents.get(id);
  }

  getDefaultAgent(): AgentConfig | undefined {
    // First, try to find an available AI agent
    const availableAiAgent = Array.from(this.agents.values()).find(
      (agent) => agent.available && agent.category === 'ai-agent'
    );
    if (availableAiAgent) return availableAiAgent;

    // Otherwise, return the first available shell
    const availableShell = Array.from(this.agents.values()).find(
      (agent) => agent.available && agent.category === 'shell'
    );
    return availableShell;
  }

  async addCustomAgent(agent: Omit<AgentConfig, 'category' | 'available'>): Promise<void> {
    const newAgent: AgentConfig = {
      ...agent,
      category: 'custom',
      available: await this.checkCommandAvailable(agent.command),
    };

    this.agents.set(agent.id, newAgent);
    await this.saveCustomAgents();
  }

  async removeCustomAgent(id: string): Promise<boolean> {
    const agent = this.agents.get(id);
    if (agent && agent.category === 'custom') {
      this.agents.delete(id);
      await this.saveCustomAgents();
      return true;
    }
    return false;
  }

  private async saveCustomAgents(): Promise<void> {
    const customAgents = Array.from(this.agents.values()).filter(
      (agent) => agent.category === 'custom'
    );

    try {
      const dir = path.dirname(this.customConfigPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.customConfigPath, JSON.stringify(customAgents, null, 2));
    } catch (error) {
      console.error('Failed to save custom agents:', error);
    }
  }
}

// Singleton instance
export const agentService = new AgentService();
