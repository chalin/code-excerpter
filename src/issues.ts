export type IssueKind = 'warning' | 'error';

export interface ReportedIssue {
  kind: IssueKind;
  message: string;
}

export type IssueReporter = (issue: ReportedIssue) => void;

export function reportWarning(
  onIssue: IssueReporter | undefined,
  message: string,
): void {
  onIssue?.({ kind: 'warning', message });
}

export function reportError(
  onIssue: IssueReporter | undefined,
  message: string,
): void {
  onIssue?.({ kind: 'error', message });
}
