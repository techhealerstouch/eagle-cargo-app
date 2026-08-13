import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface ImageCropperProps {
    image: string | null;
    open: boolean;
    onClose: () => void;
    onCropComplete: (croppedImage: Blob) => void;
    aspectRatio?: number;
}

export const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues on CodeSandbox
        image.src = url;
    });

/**
 * This function was adapted from the one in the react-easy-crop documentation
 */
export async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
): Promise<Blob | null> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return null;
    }

    const rotRad = (rotation * Math.PI) / 180;

    // calculate bounding box of the rotated image
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
        image.width,
        image.height,
        rotation
    );

    // set canvas size to match the bounding box
    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    // translate canvas context to a central point to allow rotating and flipping around the center
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);

    // draw rotated image
    ctx.drawImage(image, 0, 0);

    // croppedAreaPixels values are bounding box relative
    // extract the cropped image using these values
    const data = ctx.getImageData(
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height
    );

    // set canvas width to final desired crop size - this will clear existing context
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // paste generated rotate image with correct offsets for x,y crop values.
    ctx.putImageData(data, 0, 0);

    // As a blob
    return new Promise((resolve) => {
        canvas.toBlob((file) => {
            resolve(file);
        }, 'image/png');
    });
}

function rotateSize(width: number, height: number, rotation: number) {
    const rotRad = (rotation * Math.PI) / 180;

    return {
        width:
            Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
        height:
            Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    };
}

export default function ImageCropper({
    image,
    open,
    onClose,
    onCropComplete,
    aspectRatio = 1,
}: ImageCropperProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onCropChange = (crop: Point) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropAreaComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCrop = async () => {
        if (image && croppedAreaPixels) {
            try {
                const croppedImage = await getCroppedImg(image, croppedAreaPixels);

                if (croppedImage) {
                    onCropComplete(croppedImage);
                    onClose();
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    if (!image) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Crop Image</DialogTitle>
                    <DialogDescription>
                        Adjust the image to fit the desired area.
                    </DialogDescription>
                </DialogHeader>
                <div className="relative h-80 w-full bg-slate-900 rounded-md overflow-hidden mt-4">
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspectRatio}
                        onCropChange={onCropChange}
                        onCropComplete={onCropAreaComplete}
                        onZoomChange={onZoomChange}
                    />
                </div>
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="image-cropper-zoom" className="text-xs font-semibold tracking-wider text-slate-500">
                            Zoom
                        </label>
                        <input
                            id="image-cropper-zoom"
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            onChange={(e) => onZoomChange(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-rust"
                        />
                    </div>
                </div>
                <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={onClose} className="rounded-xl">
                        Cancel
                    </Button>
                    <Button onClick={handleCrop} className="rounded-xl bg-brand-rust hover:bg-brand-rust/90">
                        Apply Crop
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

