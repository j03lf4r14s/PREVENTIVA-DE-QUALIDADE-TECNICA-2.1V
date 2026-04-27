import { BlobServiceClient } from '@azure/storage-blob';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_CONTAINER_NAME || 'fichas-fiscais';

    if (!connectionString) {
      console.error('[upload-pdf] AZURE_STORAGE_CONNECTION_STRING is not set');
      return NextResponse.json(
        { success: false, error: 'Azure Storage connection string not configured.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const pdfBlob = formData.get('pdf') as Blob | null;
    const cliente = (formData.get('cliente') as string) || 'desconhecido';
    const tecnico = (formData.get('tecnico') as string) || 'desconhecido';
    const fiscal = (formData.get('fiscal') as string) || '';
    const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10);
    const score = (formData.get('score') as string) || '0';

    if (!pdfBlob) {
      return NextResponse.json({ success: false, error: 'PDF blob is required.' }, { status: 400 });
    }

    console.log(`[upload-pdf] Connecting to Azure — container: ${containerName}, cliente: ${cliente}`);

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Create container if it doesn't exist (returns existing info if already created)
    const createResult = await containerClient.createIfNotExists({ access: 'blob' });
    if (createResult.succeeded) {
      console.log(`[upload-pdf] Container "${containerName}" created.`);
    } else {
      console.log(`[upload-pdf] Container "${containerName}" already exists.`);
    }

    // Build structured blob name
    const sanitize = (s: string) =>
      s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const timestamp = Date.now();
    const dateFolder = data.replace(/-/g, '');
    const baseName = `fichas/${dateFolder}/${sanitize(tecnico)}_${sanitize(cliente)}_${timestamp}`;

    // Upload PDF — blocking, must complete before returning
    const pdfBlobName = `${baseName}.pdf`;
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
    const pdfBlockBlob = containerClient.getBlockBlobClient(pdfBlobName);
    console.log(`[upload-pdf] Uploading PDF: ${pdfBlobName} (${pdfBuffer.length} bytes)`);
    await pdfBlockBlob.uploadData(pdfBuffer, {
      blobHTTPHeaders: { blobContentType: 'application/pdf' },
    });
    console.log(`[upload-pdf] PDF uploaded successfully.`);

    // Upload metadata JSON — blocking
    const metadataObj = {
      cliente,
      tecnico,
      fiscal,
      data,
      score,
      uploadedAt: new Date().toISOString(),
      pdfBlobName,
    };
    const jsonBlobName = `${baseName}.json`;
    const jsonBuffer = Buffer.from(JSON.stringify(metadataObj, null, 2), 'utf-8');
    const jsonBlockBlob = containerClient.getBlockBlobClient(jsonBlobName);
    await jsonBlockBlob.uploadData(jsonBuffer, {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
    console.log(`[upload-pdf] Metadata JSON uploaded: ${jsonBlobName}`);

    const pdfUrl = pdfBlockBlob.url;
    console.log(`[upload-pdf] Done. URL: ${pdfUrl}`);

    return NextResponse.json({ success: true, url: pdfUrl, blobName: pdfBlobName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[upload-pdf] Upload failed:', message, stack);
    return NextResponse.json(
      { success: false, error: `Upload failed: ${message}` },
      { status: 500 }
    );
  }
}
