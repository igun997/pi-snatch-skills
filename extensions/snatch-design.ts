import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { normalizePublicUrl } from '../src/jobs.js';

export default function snatchDesignExtension(pi: ExtensionAPI) {
  pi.registerCommand('snatch', {
    description: 'Validate public URL; interactive consent required before capture.',
    handler: async (args, ctx) => {
      try { ctx.ui.notify(`Consent required before capture: ${normalizePublicUrl(args)}`, 'info'); }
      catch (error) { ctx.ui.notify((error as Error).message, 'error'); }
    },
  });
  pi.registerTool({
    name: 'snatch_status', label: 'Snatch Status',
    description: 'Report design-snatch job identifier and artifact lookup guidance.',
    promptGuidelines: ['Use only for authorized design-snatch jobs.'],
    parameters: Type.Object({ jobId: Type.String() }),
    async execute(_id, params) {
      return { content: [{ type: 'text', text: `Job ${params.jobId}: inspect .pi/snatch/${params.jobId}/ artifacts.` }], details: { jobId: params.jobId } };
    },
  });
}
