import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface WorkflowPrompts {
  systemPrompt: string;
  routingDescription: string;
  humanPrompt: string;
}

export interface AgentPrompts {
  [agentName: string]: string;
}

export class PromptLoader {
  private static promptsCache = new Map<string, any>();
  private static readonly PROMPTS_DIR = path.join(__dirname, '../prompts');

  static loadWorkflowPrompts(workflowName: string): WorkflowPrompts {
    const cacheKey = `workflow-${workflowName}`;

    if (this.promptsCache.has(cacheKey)) {
      return this.promptsCache.get(cacheKey);
    }

    const workflowPath = path.join(
      this.PROMPTS_DIR,
      workflowName,
      'workflow.yml'
    );

    try {
      const yamlContent = fs.readFileSync(workflowPath, 'utf8');
      const prompts = yaml.parse(yamlContent) as WorkflowPrompts;

      this.promptsCache.set(cacheKey, prompts);
      return prompts;
    } catch (error) {
      console.error(
        `Failed to load workflow prompts for ${workflowName}:`,
        error
      );
      throw new Error(`Could not load workflow prompts: ${workflowName}`);
    }
  }

  static loadAgentPrompts(workflowName: string): AgentPrompts {
    const cacheKey = `agents-${workflowName}`;

    if (this.promptsCache.has(cacheKey)) {
      return this.promptsCache.get(cacheKey);
    }

    const workflowDir = path.join(this.PROMPTS_DIR, workflowName);

    try {
      const prompts: AgentPrompts = {};

      // Dynamically load all .md files in the workflow directory
      const files = fs.readdirSync(workflowDir);
      const agentFiles = files.filter(
        file => file.endsWith('.md') && file !== 'workflow.md'
      );

      for (const file of agentFiles) {
        // Convert filename to agent name (remove .md extension and convert kebab-case to snake_case)
        const agentName = file.replace('.md', '').replace(/-/g, '_');

        prompts[agentName] = this.loadMarkdownFile(
          path.join(workflowDir, file)
        );
      }

      this.promptsCache.set(cacheKey, prompts);
      return prompts;
    } catch (error) {
      console.error(`Failed to load agent prompts for ${workflowName}:`, error);
      throw new Error(`Could not load agent prompts: ${workflowName}`);
    }
  }

  private static loadMarkdownFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf8').trim();
    } catch (error) {
      console.error(`Failed to load markdown file: ${filePath}`, error);
      throw new Error(`Could not load prompt file: ${filePath}`);
    }
  }

  // Helper method to reload prompts (useful for development)
  static clearCache(): void {
    this.promptsCache.clear();
    console.log('🔄 Prompt cache cleared');
  }

  // Development helper to watch for prompt file changes
  static enableHotReload(): void {
    if (process.env.NODE_ENV === 'development') {
      fs.watch(this.PROMPTS_DIR, { recursive: true }, (eventType, filename) => {
        if (
          filename &&
          (filename.endsWith('.yml') || filename.endsWith('.md'))
        ) {
          console.log(`🔄 Prompt file changed: ${filename} - clearing cache`);
          this.clearCache();
        }
      });
    }
  }
}
