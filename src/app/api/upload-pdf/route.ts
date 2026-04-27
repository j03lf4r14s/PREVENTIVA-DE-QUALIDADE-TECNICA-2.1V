import { BlobServiceClient, PublicAccessType } from '@azure/storage-blob';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_CONTAINER_NAME || 'fichas-fiscais';

    if (!connectionString) {
      return NextResponse.json(
        { error: 'Azure Storage connection string not configured.' },
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
      return NextResponse.json({ error: 'PDF blob is required.' }, { status: 400 });
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Create container if it doesn't exist, with public blob-level access
    const exists = await containerClient.exists();
    if (!exists) {
      await containerClient.create({ access: 'blob' as PublicAccessType });
    }

    // Build structured blob name
    const sanitize = (s: string) =>
      s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const timestamp = Date.now();
    const dateFolder = data.replace(/-/g, '');
    const baseName = `fichas/${dateFolder}/${sanitize(tecnico)}_${sanitize(cliente)}_${timestamp}`;

    // Upload PDF
    const pdfBlobName = `${baseName}.pdf`;
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
    const pdfBlockBlob = containerClient.getBlockBlobClient(pdfBlobName);
    await pdfBlockBlob.uploadData(pdfBuffer, {
      blobHTTPHeaders: { blobContentType: 'application/pdf' },
    });

    // Upload metadata JSON
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

    const pdfUrl = pdfBlockBlob.url;

    return NextResponse.json({ success: true, url: pdfUrl, blobName: pdfBlobName });
  } catch (err) {
    console.error('[upload-pdf] Error:', err);
    return NextResponse.json(
      { error: 'Failed to upload PDF to Azure Blob Storage.' },
      { status: 500 }
    );
  }
}
