export type IssueLevel = "error" | "warning";
export type IssueConfidence = "high" | "medium" | "low";

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  file?: string;
  confidence?: IssueConfidence;
}

export interface LintOptions {
  strict?: boolean;
}

export interface SkillForgeConfig {
  name?: string;
  type?: "skill" | "plugin";
  examples?: Array<{
    prompt: string;
    shouldTrigger: boolean;
  }>;
  checks?: {
    maxSkillMdLines?: number;
    requireOpenAiYaml?: boolean;
    allowScripts?: boolean;
  };
}

export interface LintResult {
  targetPath: string;
  kind: "skill" | "plugin" | "collection" | "unknown";
  issues: Issue[];
  checkedPaths?: string[];
}
