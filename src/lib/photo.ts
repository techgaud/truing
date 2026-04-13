const MAX_PHOTO_DIM = 1024;
const JPEG_QUALITY = 0.85;

export async function resizeImage(file: Blob): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			let { width, height } = img;
			if (width > MAX_PHOTO_DIM || height > MAX_PHOTO_DIM) {
				const scale = MAX_PHOTO_DIM / Math.max(width, height);
				width = Math.round(width * scale);
				height = Math.round(height * scale);
			}
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) return reject(new Error('Canvas not supported'));
			ctx.drawImage(img, 0, 0, width, height);
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
				'image/jpeg',
				JPEG_QUALITY
			);
		};
		img.onerror = () => reject(new Error('Failed to load image'));
		img.src = URL.createObjectURL(file);
	});
}

export async function pickPhoto(): Promise<Blob | null> {
	if (
		(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
	) {
		try {
			const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
			const photo = await Camera.getPhoto({
				quality: 90,
				allowEditing: false,
				resultType: CameraResultType.Uri,
				source: CameraSource.Prompt
			});
			if (!photo.webPath) return null;
			const res = await fetch(photo.webPath);
			return res.blob();
		} catch {
			return null;
		}
	}
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.click();
	});
}
