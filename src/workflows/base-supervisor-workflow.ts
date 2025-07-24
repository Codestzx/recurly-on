import { END, Annotation, InMemoryStore } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { RunnableConfig } from '@langchain/core/runnables';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SystemMessage } from '@langchain/core/messages';
import { HumanMessage } from '@langchain/core/messages';
import { START, StateGraph } from '@langchain/langgraph';
import { GitHubService } from '../services/github';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { ChatAnthropic } from '@langchain/anthropic';

export interface AgentConfig {
  name: string;
  tools: any[];
  systemPrompt: string;
}

export interface WorkflowConfig {
  members: string[];
  systemPrompt: string;
  routingDescription: string;
  humanPrompt: string;
  model: string;
  temperature?: number;
  maxRetries?: number;
  recursionLimit?: number;
  topP?: number;
  maxTokens?: number;
}

export abstract class BaseSupervisorWorkflow<TContext = any> {
  protected agentState: any;
  protected options!: string[];
  protected routingTool: any;
  protected prompt!: ChatPromptTemplate;
  protected store: InMemoryStore;
  protected checkpointer: MemorySaver;

  constructor(
    protected githubService: GitHubService,
    protected config: WorkflowConfig
  ) {
    this.store = new InMemoryStore();
    this.checkpointer = new MemorySaver();
    this.setupRouting();
    this.setupPrompt();
  }

  private initializeBaseState() {
    if (!this.agentState) {
      this.agentState = Annotation.Root({
        messages: Annotation<BaseMessage[]>({
          reducer: (x, y) => x.concat(y),
          default: () => [],
        }),
        next: Annotation<string>({
          reducer: (x, y) => y ?? x ?? END,
          default: () => END,
        }),
        // Allow subclasses to add custom context
        ...this.getAdditionalStateFields(),
      });
    }
  }

  private setupRouting() {
    this.options = [END, ...this.config.members];
    this.routingTool = {
      name: 'route',
      description: this.config.routingDescription,
      schema: z.object({
        next: z.enum([END, ...this.config.members] as [string, ...string[]]),
      }),
    };
  }

  private setupPrompt() {
    this.prompt = ChatPromptTemplate.fromMessages([
      ['system', this.config.systemPrompt],
      new MessagesPlaceholder('messages'),
      ['human', this.config.humanPrompt],
    ]);
  }

  // Abstract methods that subclasses must implement
  protected abstract getAdditionalStateFields(): Record<string, any>;
  protected abstract getAgentConfigs(): AgentConfig[];
  protected abstract createInitialMessage(
    owner: string,
    repo: string,
    prNumber: number,
    context?: TContext
  ): string;

  async execute(
    owner: string,
    repo: string,
    prNumber: number,
    context?: TContext
  ) {
    try {
      // Initialize state if not already done
      this.initializeBaseState();

      const formattedPrompt = await this.prompt.partial({
        options: this.options.join(', '),
        members: this.config.members.join(', '),
      });

      const llm = new ChatAnthropic({
        model: this.config.model,
        maxRetries: this.config.maxRetries || 3,
        ...(this.config.temperature && {
          temperature: this.config.temperature,
        }),
        ...(this.config.topP && { topP: this.config.topP }),
        maxTokens: this.config.maxTokens || undefined,
      });

      const supervisorChain = formattedPrompt
        .pipe(
          llm.bindTools([this.routingTool], {
            tool_choice: 'route',
          })
        )
        .pipe(x => x?.tool_calls?.[0]?.args);

      // Build workflow
      const workflow = this.buildWorkflow(llm, supervisorChain);
      const graph = workflow.compile({
        store: this.store,
        checkpointer: this.checkpointer,
      });

      // Create initial message
      const initialMessage = this.createInitialMessage(
        owner,
        repo,
        prNumber,
        context
      );

      // Execute workflow
      const initialState: any = {
        messages: [new HumanMessage({ content: initialMessage })],
      };

      // Add context if provided
      if (context) {
        Object.assign(initialState, this.getContextState(context));
      }

      console.log('Executing workflow', {
        owner,
        repo,
        prNumber,
        initialState,
      });

      const result = await graph.invoke(initialState, {
        recursionLimit: this.config.recursionLimit || 100,
        configurable: {
          thread_id: `${owner}/${repo}#${prNumber}`,
        },
      });

      // Log messages for debugging
      result.messages.forEach((message: any) => {
        console.log(message.name);
        console.log(message.content);
        console.log('--------------------------------');
      });

      const lastMessage = result.messages[result.messages.length - 1];
      return lastMessage;
    } catch (error) {
      console.error(`${this.constructor.name} execution failed:`, error);
      throw error;
    }
  }

  private buildWorkflow(
    llm: ChatVertexAI | ChatAnthropic,
    supervisorChain: any
  ) {
    try {
      const workflow = new StateGraph(this.agentState);

      // Add supervisor node
      workflow.addNode('supervisor', supervisorChain as any);

      // Add agent nodes
      const agentConfigs = this.getAgentConfigs();
      agentConfigs.forEach(agentConfig => {
        const agent = createReactAgent({
          llm: llm,
          tools: agentConfig.tools,
          prompt: new SystemMessage(agentConfig.systemPrompt),
        });

        const agentNode = async (
          state: typeof this.agentState.State,
          config?: RunnableConfig
        ) => {
          const result = await agent.invoke(state, config);
          const lastMessage = result.messages[result.messages.length - 1];
          return {
            messages: [
              new HumanMessage({
                content: lastMessage.content,
                name: this.formatAgentName(agentConfig.name),
              }),
            ],
          };
        };

        workflow.addNode(agentConfig.name, agentNode);
      });

      // Add edges
      this.config.members.forEach(member => {
        workflow.addEdge(member as any, 'supervisor' as any);
      });

      workflow.addConditionalEdges(
        'supervisor' as any,
        (x: typeof this.agentState.State) => x.next
      );

      workflow.addEdge(START, 'supervisor' as any);

      return workflow;
    } catch (error) {
      console.error(`${this.constructor.name} workflow build failed:`, error);
      throw error;
    }
  }

  private formatAgentName(name: string): string {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('_');
  }

  protected getContextState(_context: TContext): Record<string, any> {
    return {};
  }
}
