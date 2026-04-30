import { getModelUsageSnapshot } from '@/lib/model-usage';

export async function GET() {
  return Response.json({
    updatedAt: new Date().toISOString(),
    models: getModelUsageSnapshot(),
  });
}
