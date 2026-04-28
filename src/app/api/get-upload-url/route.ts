import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseCredentialsFromConnectionString(cs: string): {
  accountName: string;
  accountKey: string;
} {
  const parts: Record<string, string> = {};
  cs.split(';').forEach((segment) => {
    const idx = segment.indexOf('=');
    if (idx > 0) {
      parts[segment.substring(0, idx)] = segment.substring(idx + 1);
    }
  });
  if (!parts.AccountName) {
    throw new Error('Invalid connection string: missing AccountName');
  }
  // AccountKey is base64 and may contain trailing '=' padding — extract via regex to preserve them
  const keyMatch = cs.match(/AccountKey=([^;]+)/);
  const accountKey = keyMatch ? keyMatch[1] : parts.AccountKey;
  if (!accountKey) {
    throw new Error('Invalid connection string: missing AccountKey');
  }
  return { accountName: parts.AccountName, accountKey };
}

export async function POST(request: NextRequest) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_CONTAINER_NAME || 'fichas-fiscais';

  if (!connectionString) {
    return NextResponse.json(
      { success: false, error: 'Azure Storage connection string not configured.' },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const cliente: string = body.cliente || 'desconhecido';
  const tecnico: string = body.tecnico || 'desconhecido';
  const fiscal: string = body.fiscal || '';
  const data: string = body.data || new Date().toISOString().slice(0, 10);
  const score: string = String(body.score ?? '0');
  const checklist: unknown = body.checklist ?? {};

  // Step 0: initialise clients
  let blobServiceClient: BlobServiceClient;
  let sharedKeyCredential: StorageSharedKeyCredential;
  let accountName: string;

  try {
    // fromConnectionString handles URL construction correctly for all account types
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const creds = parseCredentialsFromConnectionString(connectionString);
    accountName = creds.accountName;
    sharedKeyCredential = new StorageSharedKeyCredential(creds.accountName, creds.accountKey);
    console.log(`[get-upload-url] Initialised BlobServiceClient for account: ${accountName}`);
  } catch (initErr: unknown) {
    const msg = initErr instanceof Error ? initErr.message : String(initErr);
    console.error('[get-upload-url] Client initialisation failed:', msg);
    return NextResponse.json(
      { success: false, error: `Azure client initialisation failed: ${msg}` },
      { status: 500 }
    );
  }

  // Step 1: ensure container exists
  let containerClient;
  try {
    containerClient = blobServiceClient.getContainerClient(containerName);
    const createResult = await containerClient.createIfNotExists({ access: 'blob' });
    if (createResult.succeeded) {
      console.log(`[get-upload-url] Container "${containerName}" created.`);
    } else {
      console.log(`[get-upload-url] Container "${containerName}" already exists.`);
    }
  } catch (containerErr: unknown) {
    const msg = containerErr instanceof Error ? containerErr.message : String(containerErr);
    console.error('[get-upload-url] Container operation failed:', msg);
    return NextResponse.json(
      { success: false, error: `Container operation failed: ${msg}` },
      { status: 500 }
    );
  }

  const sanitize = (s: string) =>
    s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
  const timestamp = Date.now();
  const dateFolder = data.replace(/-/g, '');
  const baseName = `fichas/${dateFolder}/${sanitize(tecnico)}_${sanitize(cliente)}_${timestamp}`;
  const pdfBlobName = `${baseName}.pdf`;

  // Step 2: generate SAS token (write-only, 10-minute expiry)
  let uploadUrl: string;
  try {
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
    uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${pdfBlobName}?${sasToken}`;
    console.log(`[get-upload-url] SAS token generated for: ${pdfBlobName}`);
  } catch (sasErr: unknown) {
    const msg = sasErr instanceof Error ? sasErr.message : String(sasErr);
    console.error('[get-upload-url] SAS token generation failed:', msg);
    return NextResponse.json(
      { success: false, error: `SAS token generation failed: ${msg}` },
      { status: 500 }
    );
  }

  // Step 3: upload metadata JSON from server
  try {
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
  } catch (metaErr: unknown) {
    const msg = metaErr instanceof Error ? metaErr.message : String(metaErr);
    console.error('[get-upload-url] Metadata upload failed:', msg);
    return NextResponse.json(
      { success: false, error: `Metadata upload failed: ${msg}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, uploadUrl, blobName: pdfBlobName });
}
