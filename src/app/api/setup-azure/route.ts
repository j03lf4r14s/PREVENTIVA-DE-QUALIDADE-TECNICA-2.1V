import { BlobServiceClient } from '@azure/storage-blob';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    return NextResponse.json(
      { success: false, error: 'AZURE_STORAGE_CONNECTION_STRING is not set.' },
      { status: 500 }
    );
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    await blobServiceClient.setProperties({
      cors: [
        {
          allowedOrigins: '*',
          allowedMethods: 'PUT,GET,HEAD,DELETE',
          allowedHeaders: '*',
          exposedHeaders: '*',
          maxAgeInSeconds: 3600,
        },
      ],
    });

    console.log('[setup-azure] CORS rules configured successfully.');
    return NextResponse.json({
      success: true,
      message: 'CORS rules configured on Azure Storage account.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[setup-azure] Failed to configure CORS:', message);
    return NextResponse.json(
      { success: false, error: `Failed to configure CORS: ${message}` },
      { status: 500 }
    );
  }
}
