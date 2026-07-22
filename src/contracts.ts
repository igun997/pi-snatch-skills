/** A user's asserted authority for a snatch job. */
export type PermissionMode = 'owned-or-authorized' | 'private-learning';

/** A named, future-extensible capture configuration. */
export interface CaptureProfile {
  name: string;
}

export type JobStatus = 'created' | 'capturing' | 'captured' | 'validated' | 'failed';

export interface CaptureConsent {
  origin: string;
  permissionMode: PermissionMode;
  createdAt: string;
}

/** Persisted job metadata. It deliberately contains no captured page content. */
export interface SnatchJob {
  id: string;
  rootUrl: string;
  status: JobStatus;
  consent: CaptureConsent;
}

export interface CaptureArtifact {
  path: string;
  mediaType: string;
  sha256: string;
}

/** An inventory of artifacts, not their contents. */
export interface CaptureManifest {
  jobId: string;
  createdAt: string;
  artifacts: CaptureArtifact[];
}

export interface ValidationFinding {
  code: string;
  message: string;
  artifactPath?: string;
}

export interface ValidationReport {
  jobId: string;
  validatedAt: string;
  passed: boolean;
  findings: ValidationFinding[];
}
