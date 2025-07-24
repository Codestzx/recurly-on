import { GitHubService } from '../services/github';
import {
  BaseSupervisorWorkflow,
  AgentConfig,
  WorkflowConfig,
} from './base-supervisor-workflow';
import { Annotation } from '@langchain/langgraph';
import { PromptLoader } from '../utils/prompt-loader';

export interface InteractiveContext {
  type: 'comment' | 'push' | 'mention' | 'question';
  userQuery?: string;
  changedFiles?: string[];
  specificFile?: string;
  lineNumber?: number;
  user?: string;
}

export class InteractivePRAssistant extends BaseSupervisorWorkflow<InteractiveContext> {
  constructor(githubService: GitHubService) {
    // Load workflow prompts from files
    const workflowPrompts = PromptLoader.loadWorkflowPrompts(
      'interactive-assistant'
    );

    const config: WorkflowConfig = {
      members: [
        'summarizer',
        'security_agent',
        'performance_agent',
        'code_quality_agent',
        'responder',
      ],
      systemPrompt: workflowPrompts.systemPrompt,
      routingDescription: workflowPrompts.routingDescription,
      humanPrompt: workflowPrompts.humanPrompt,
      model: 'claude-sonnet-4-20250514',
      recursionLimit: 50,
    };

    super(githubService, config);
  }

  protected getAdditionalStateFields(): Record<string, any> {
    return {
      userContext: Annotation<InteractiveContext>({
        reducer: (x: InteractiveContext, y: InteractiveContext) => y ?? x,
        default: () => ({ type: 'comment' }),
      }),
    };
  }

  protected getAgentConfigs(): AgentConfig[] {
    // Load agent prompts from files
    const agentPrompts = PromptLoader.loadAgentPrompts('interactive-assistant');

    return [
      {
        name: 'summarizer',
        tools: [
          this.githubService.getPullRequestTool(),
          this.githubService.getPullRequestFilesTool(),
          this.githubService.getFileContentTool(),
          this.githubService.getPullRequestDiffTool(),
        ],
        systemPrompt: agentPrompts.summarizer,
      },
      {
        name: 'security_agent',
        tools: [],
        systemPrompt: agentPrompts.security_agent,
      },
      {
        name: 'performance_agent',
        tools: [],
        systemPrompt: agentPrompts.performance_agent,
      },
      {
        name: 'code_quality_agent',
        tools: [],
        systemPrompt: agentPrompts.code_quality_agent,
      },
      {
        name: 'responder',
        tools: [],
        systemPrompt: agentPrompts.responder,
      },
    ];
  }

  protected createInitialMessage(
    owner: string,
    repo: string,
    prNumber: number,
    context?: InteractiveContext
  ): string {
    const baseMessage = `${owner}/${repo}#${prNumber}`;

    if (!context) {
      return `Provide general assistance for ${baseMessage}`;
    }

    switch (context.type) {
      case 'mention':
      case 'question':
        return `User question about ${baseMessage}: "${context.userQuery}"${
          context.specificFile ? ` regarding file: ${context.specificFile}` : ''
        }${context.lineNumber ? ` at line ${context.lineNumber}` : ''}`;

      case 'comment':
        return `User commented on ${baseMessage}: "${context.userQuery}" - provide helpful response`;

      case 'push':
        return `New changes pushed to ${baseMessage}${
          context.changedFiles?.length
            ? `. Changed files: ${context.changedFiles.join(', ')}`
            : ''
        }. Analyze what changed.`;

      default:
        return `Provide assistance for ${baseMessage}`;
    }
  }

  protected getContextState(context: InteractiveContext): Record<string, any> {
    return {
      userContext: context,
    };
  }

  // Helper method to handle bot commands (compatible with existing webhook code)
  async handleBotCommand(
    owner: string,
    repo: string,
    prNumber: number,
    command: string,
    user: string,
    specificFile?: string,
    lineNumber?: number
  ) {
    const context: InteractiveContext = {
      type: 'mention',
      userQuery: command,
      specificFile,
      lineNumber,
      user,
    };

    return this.execute(owner, repo, prNumber, context);
  }
}
