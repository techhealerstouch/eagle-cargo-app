/**
 * Client-side image compression utility.
 * Downscales smartphone camera photos (5-15MB) to ~200-400KB before uploading,
 * dramatically reducing network bandwidth and upload latency in the field.
 */

export interface ImageCompressionOptions {
    maxDimension?: number;
    quality?: number;
    outputType?: 'image/jpeg' | 'image/webp';
}

export async function compressImage(
    file: File,
    options: ImageCompressionOptions = {},
): Promise<File> {
    // If not an image or already a tiny SVG/GIF, return as-is
    if (!file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('gif')) {
        return file;
    }

    const {
        maxDimension = 1600,
        quality = 0.82,
        outputType = 'image/jpeg',
    } = options;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;

                // Downscale while preserving aspect ratio
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    // Fallback to original file if canvas 2D context fails
                    resolve(file);
                    return;
                }

                // Draw and convert to JPEG/WebP
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob || blob.size >= file.size) {
                            // If compression didn't reduce size, keep original
                            resolve(file);
                            return;
                        }

                        const ext = outputType === 'image/webp' ? '.webp' : '.jpg';
                        const newFileName = file.name.replace(/\.[^/.]+$/, '') + ext;
                        const compressedFile = new File([blob], newFileName, {
                            type: outputType,
                            lastModified: Date.now(),
                        });

                        resolve(compressedFile);
                    },
                    outputType,
                    quality,
                );
            };

            img.onerror = () => resolve(file);
            img.src = e.target?.result as string;
        };

        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
