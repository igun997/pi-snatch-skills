import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

export default function snatchDesignExtension(pi: ExtensionAPI) {
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
