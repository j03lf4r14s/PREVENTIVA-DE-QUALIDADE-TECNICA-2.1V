import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseConnectionString(cs: string): { accountName: string; accountKey: string } {
  const parts: Record<string, string> = {};
  cs.split(';').forEach((segment) => {
    const idx = segment.indexOf('=');
    if (idx > 0) {
      parts[segment.substring(0, idx)] = segment.substring(idx + 1);
    }
  });
  if (!parts.AccountName || !parts.AccountKey) {
    throw new Error('Invalid connection string: missing AccountName or AccountKey');
  }
  // AccountKey may contain padding '=' stripped by the simple split above —
  // reconstruct it from the raw string to preserve base64 padding.
  const keyMatch = cs.match(/AccountKey=([^;]+)/);
  if (keyMatch) parts.AccountKey = keyMatch[1];
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

export async function POST(request: NextRequest) {
  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_CONTAINER_NAME || 'fichas-fiscais';

    if (!connectionString) {
      return NextResponse.json(
        { success: false, error: 'Azure Storage connection string not configured.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const cliente: string = body.cliente || 'desconhecido';
    const tecnico: string = body.tecnico || 'desconhecido';
    const fiscal: string = body.fiscal || '';
    const data: string = body.data || new Date().toISOString().slice(0, 10);
    const score: string = String(body.score ?? '0');
    const checklist: unknown = body.checklist ?? {};

    const { accountName, accountKey } = parseConnectionString(connectionString);
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const createResult = await containerClient.createIfNotExists({ access: 'blob' });
    if (createResult.succeeded) {
      console.log(`[get-upload-url] Container "${containerName}" created.`);
    }

    const sanitize = (s: string) =>
      s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const timestamp = Date.now();
    const dateFolder = data.replace(/-/g, '');
    const baseName = `fichas/${dateFolder}/${sanitize(tecnico)}_${sanitize(cliente)}_${timestamp}`;
    const pdfBlobName = `${baseName}.pdf`;

    // Generate SAS token valid 10 minutes with write permission
    const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: pdfBlobName,
        permissions: BlobSASPermissions.parse('w'),
        expiresOn,
        contentType: 'application/pdf',
      },
      sharedKeyCredential
    ).toString();

    const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${pdfBlobName}?${sasToken}`;

    // Upload metadata JSON directly from server (small payload)
    const metadataObj = {
      cliente,
      tecnico,
      fiscal,
      data,
      score,
      checklist,
      uploadedAt: new Date().toISOString(),
      pdfBlobName,
    };
    const jsonBlobName = `${baseName}.json`;
    const jsonBuffer = Buffer.from(JSON.stringify(metadataObj, null, 2), 'utf-8');
    const jsonBlockBlob = containerClient.getBlockBlobClient(jsonBlobName);
    await jsonBlockBlob.uploadData(jsonBuffer, {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
    console.log(`[get-upload-url] Metadata JSON uploaded: ${jsonBlobName}`);

    return NextResponse.json({ success: true, uploadUrl, blobName: pdfBlobName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[get-upload-url] Failed:', message);
    return NextResponse.json(
      { success: false, error: `Failed to generate upload URL: ${message}` },
      { status: 500 }
    );
  }
}
