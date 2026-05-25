import { timed } from './timing';

/**
 * Normalizes an image for Gemini Vision processing.
 * - Handles EXIF orientation (rotation).
 * - Downscales if long edge > 1600px.
 * - Converts to image/jpeg at 0.92 quality.
 * - Returns raw base64 (without prefix) and mimeType.
 */
export async function normalizeImageForVision(file: File): Promise<{
  base64: string;
  mimeType: string;
}> {
  return await timed('lib.normalizeImageForVision', async () => {
    try {
      let imgSource: TexImageSource | HTMLImageElement;

      try {
        // Modern approach: Handles EXIF rotation automatically
        imgSource = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        // Fallback for older browsers or if createImageBitmap fails
        imgSource = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = URL.createObjectURL(file);
        });
      }

      const originalWidth = (imgSource as HTMLImageElement).width || (imgSource as HTMLImageElement).naturalWidth || (imgSource as ImageBitmap).width;
      const originalHeight = (imgSource as HTMLImageElement).height || (imgSource as HTMLImageElement).naturalHeight || (imgSource as ImageBitmap).height;

      let targetWidth = originalWidth;
      let targetHeight = originalHeight;
      
      const isPng = file.type === 'image/png';
      const maxEdge = isPng ? 3072 : 2048;
      const outputMimeType = isPng ? 'image/png' : 'image/jpeg';

      if (originalWidth > maxEdge || originalHeight > maxEdge) {
        if (originalWidth > originalHeight) {
          targetWidth = maxEdge;
          targetHeight = Math.round((originalHeight * maxEdge) / originalWidth);
        } else {
          targetHeight = maxEdge;
          targetWidth = Math.round((originalWidth * maxEdge) / originalHeight);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      ctx.drawImage(imgSource, 0, 0, targetWidth, targetHeight);

      // Clean up object URL if we used the fallback
      if (!(imgSource instanceof ImageBitmap)) {
        URL.revokeObjectURL((imgSource as HTMLImageElement).src);
      } else {
        imgSource.close(); // Close ImageBitmap to free resources
      }

      const base64DataWithPrefix = isPng
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', 0.95);
      const base64 = base64DataWithPrefix.split(',')[1];

      return {
        base64,
        mimeType: outputMimeType
      };
    } catch (error) {
      console.error('Image normalization failed, falling back to original:', error);
      
      // Fallback: Convert original file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      return {
        base64,
        mimeType: file.type
      };
    }
  });
}
