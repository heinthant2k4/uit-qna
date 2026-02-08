export const QNA_IMAGE_BUCKET = 'qna-images';
export const MAX_IMAGES_PER_POST = 4;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

export function isAllowedImageMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_SET.has(mimeType);
}

export function normalizeImagePaths(paths?: string[]): string[] {
  if (!paths?.length) return [];

  const unique = new Set<string>();

  for (const raw of paths) {
    const value = raw.trim();
    if (!value) continue;

    if (value.length > 512 || value.startsWith('/') || value.includes('..')) {
      throw new Error('INVALID_INPUT:Invalid image path.');
    }

    unique.add(value);
  }

  if (unique.size > MAX_IMAGES_PER_POST) {
    throw new Error(`INVALID_INPUT:You can attach up to ${MAX_IMAGES_PER_POST} images.`);
  }

  return [...unique];
}

export function toPublicImageUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    return '';
  }

  const encodedPath = path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${QNA_IMAGE_BUCKET}/${encodedPath}`;
}

