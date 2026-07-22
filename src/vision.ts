export type VisionVerdict = 'match' | 'fix' | 'uncertain';
export interface VisionIssue { region: string; severity: 'low' | 'medium' | 'high'; evidence: string; fix: string }
export interface VisionReview { verdict: VisionVerdict; issues: VisionIssue[] }

export function parseVisionReview(value: string): VisionReview {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('Vision review must be JSON.'); }
  if (!parsed || typeof parsed !== 'object') throw new Error('Vision review must be an object.');
  const review = parsed as Partial<VisionReview>;
  if (!['match', 'fix', 'uncertain'].includes(review.verdict ?? '')) throw new Error('Vision review has invalid verdict.');
  if (!Array.isArray(review.issues)) throw new Error('Vision review must include issues.');
  for (const issue of review.issues) {
    if (!issue || !['low', 'medium', 'high'].includes(issue.severity) || !issue.region || !issue.evidence || !issue.fix) {
      throw new Error('Vision review has invalid issue.');
    }
  }
  return review as VisionReview;
}
