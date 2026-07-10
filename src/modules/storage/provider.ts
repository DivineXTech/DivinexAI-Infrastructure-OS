export interface StorageProvider {
  createSignedDownloadUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string>;
  createSignedUploadUrl(bucket: string, path: string): Promise<{ signedUrl: string; token: string }>;
  removeObject(bucket: string, path: string): Promise<void>;
}
