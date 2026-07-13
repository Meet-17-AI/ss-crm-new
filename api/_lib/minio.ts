import * as Minio from 'minio';
import * as crypto from 'crypto';
import * as https from 'https';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const ENDPOINT = process.env.MINIO_ENDPOINT || 's3.srv1169280.hstgr.cloud';
const PORT = parseInt(process.env.MINIO_PORT || '443');
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'admin';
const SECRET_KEY = process.env.MINIO_SECRET_KEY || 'Fluidbucket@2026';
const USE_SSL = process.env.MINIO_USE_SSL !== 'false';
export const bucketName = process.env.MINIO_BUCKET_NAME || 'safestories-panel';

// Keep minioClient for non-upload operations (delete, presigned URLs)
export const minioClient = new Minio.Client({
  endPoint: ENDPOINT,
  port: PORT,
  useSSL: USE_SSL,
  accessKey: ACCESS_KEY,
  secretKey: SECRET_KEY,
  region: 'us-east-1',
  pathStyle: true,
});

// AWS4 signing helpers
function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac('AWS4' + secretKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

/**
 * Upload a file to MinIO using direct AWS4-signed HTTP PUT
 */
export async function uploadFile(
  file: Buffer,
  fileName: string,
  folder: 'profile-pictures' | 'qualification-pdfs' | 'issue-screenshots',
  contentType: string
): Promise<string> {
  const objectName = `${folder}/${fileName}`;
  const region = 'us-east-1';
  const service = 's3';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = crypto.createHash('sha256').update(file).digest('hex');
  const host = `${ENDPOINT}:${PORT}`;
  const path = `/${bucketName}/${objectName}`;

  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = getSigningKey(SECRET_KEY, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  console.log('🔄 MinIO direct upload:', { objectName, size: file.length, host, secretKeyLast4: SECRET_KEY.slice(-4) });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: ENDPOINT,
      port: PORT,
      path,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': file.length,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authorization,
      },
      rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const url = `https://${ENDPOINT}:${PORT}/${bucketName}/${objectName}`;
          console.log('✅ MinIO upload complete:', url);
          resolve(url);
        } else {
          console.error('❌ MinIO upload HTTP error:', res.statusCode, body);
          reject(new Error(`MinIO upload failed: HTTP ${res.statusCode} - ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ MinIO upload request error:', e.message);
      reject(new Error(`MinIO upload failed: ${e.message}`));
    });

    req.write(file);
    req.end();
  });
}

/**
 * Delete a file from MinIO
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  try {
    const urlParts = fileUrl.split(`/${bucketName}/`);
    if (urlParts.length < 2) throw new Error('Invalid file URL');
    await minioClient.removeObject(bucketName, urlParts[1]);
  } catch (error) {
    console.error('Error deleting file from MinIO:', error);
    throw new Error('Failed to delete file');
  }
}

/**
 * Get a presigned URL for temporary access to a file
 */
export async function getPresignedUrl(
  objectName: string,
  expirySeconds: number = 86400
): Promise<string> {
  try {
    return await minioClient.presignedGetObject(bucketName, objectName, expirySeconds);
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
}
