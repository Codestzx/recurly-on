import { GitHubService } from '../services/github';
import {
  BaseSupervisorWorkflow,
  AgentConfig,
  WorkflowConfig,
} from './base-supervisor-workflow';
import { PromptLoader } from '../utils/prompt-loader';

export class InitialCodeReviewService extends BaseSupervisorWorkflow {
  constructor(githubService: GitHubService) {
    // Load workflow prompts from files
    const workflowPrompts = PromptLoader.loadWorkflowPrompts('code-reviewer');

    const config: WorkflowConfig = {
      members: [
        'summarizer',
        'security_agent',
        'performance_agent',
        'code_quality_agent',
        'reviewer',
      ],
      systemPrompt: workflowPrompts.systemPrompt,
      routingDescription: workflowPrompts.routingDescription,
      humanPrompt: workflowPrompts.humanPrompt,
      model: 'claude-sonnet-4-20250514',
      maxRetries: 3,
      recursionLimit: 80,
    };

    super(githubService, config);
  }

  protected getAdditionalStateFields(): Record<string, any> {
    // No additional fields needed for initial review
    return {};
  }

  protected getAgentConfigs(): AgentConfig[] {
    // Load agent prompts from files
    const agentPrompts = PromptLoader.loadAgentPrompts('code-reviewer');

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
        name: 'reviewer',
        tools: [],
        systemPrompt: agentPrompts.reviewer,
      },
    ];
  }

  protected createInitialMessage(
    owner: string,
    repo: string,
    prNumber: number
  ): string {
    return `
      You are tasked with reviewing a pull request.

      The information you got is:

      - Owner: ${owner}
      - Repository: ${repo}
      - Pull Request Number: ${prNumber}

      You MUST use the tools provided to you to review the pull request.
      You MUST avoid providing generic responses.
      You MUST avoid providing responses that are not related to the pull request.
      You MUST be specific, proportional and actionable.
      You MUST be senior engineer tone, not assistant tone.
      You MUST be helpful, not generic.
    `;
  }
}
