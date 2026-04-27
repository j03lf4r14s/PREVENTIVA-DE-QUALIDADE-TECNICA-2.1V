import { BlobServiceClient } from '@azure/storage-blob';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    return NextResponse.json({
      connected: false,
      containers: [],
      error: 'AZURE_STORAGE_CONNECTION_STRING is not set in environment variables.',
    });
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containers: string[] = [];

    for await (const container of blobServiceClient.listContainers()) {
      containers.push(container.name);
    }

    return NextResponse.json({ connected: true, containers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[test-azure] Connection test failed:', message);
    return NextResponse.json({ connected: false, containers: [], error: message });
  }
}
