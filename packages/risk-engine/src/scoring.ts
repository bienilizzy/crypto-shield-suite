import { Finding, RiskReport, Severity, SubjectType } from "@crypto-shield/types";

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreToSeverity(score: number): Severity {
  if (score >= 80) return Severity.Safe;
  if (score >= 50) return Severity.Caution;
  if (score >= 20) return Severity.Risky;
  return Severity.Critical;
}

/**
 * Combines per-finding scores into one overall score.
 * Weighted toward the worst finding so a single critical issue
 * can't be diluted by many unrelated "safe" findings.
 */
export function aggregateScore(findings: Finding[]): number {
  if (findings.length === 0) return 100;

  const scores = findings.map((f) => f.score);
  const min = Math.min(...scores);
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  return clampScore(min * 0.6 + avg * 0.4);
}

export function buildRiskReport(
  subject: string,
  subjectType: SubjectType,
  findings: Finding[],
): RiskReport {
  const overallScore = aggregateScore(findings);

  return {
    subject,
    subjectType,
    overallScore,
    severity: scoreToSeverity(overallScore),
    findings,
    recommendations: findings
      .filter((f): f is Finding & { recommendation: string } => Boolean(f.recommendation))
      .map((f) => f.recommendation),
    generatedAt: new Date().toISOString(),
  };
}
