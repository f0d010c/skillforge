export type IssueLevel = "error" | "warning";
export type IssueImpact = "blocking" | "advisory";
export type LintProfile = "source" | "marketplace";

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  file?: string;
  impact?: IssueImpact;
}

export interface LintOptions {
  strict?: boolean;
  profile?: LintProfile;
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
  profile?: LintProfile;
  checkedPaths?: string[];
}
