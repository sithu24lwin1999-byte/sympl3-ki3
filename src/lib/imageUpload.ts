const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_LOGO_FILE_BYTES = 3 * 1024 * 1024;
const MAX_STORED_DATA_URL_LENGTH = 700_000;

export function validateImageFile(file: Pick<File, 'type' | 'size'>, label = 'Image') {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > MAX_LOGO_FILE_BYTES) throw new Error(`${label} must be 3 MB or smaller.`);
}

export function validateLogoFile(file: Pick<File, 'type' | 'size'>) {
  validateImageFile(file, 'Logo image');
}

export function prepareImage(file: File, options: { label?: string; maxDimension?: number } = {}): Promise<string> {
  const label = options.label || 'Image';
  validateImageFile(file, label);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Unable to read the ${label.toLowerCase()}.`));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error(`The selected ${label.toLowerCase()} is invalid.`));
      image.onload = () => {
        const scale = Math.min(1, (options.maxDimension || 1_000) / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) { reject(new Error('Image processing is not available in this browser.')); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.88, 0.76, 0.64, 0.52]) {
          const value = canvas.toDataURL('image/webp', quality);
          if (value.length <= MAX_STORED_DATA_URL_LENGTH) { resolve(value); return; }
        }
        reject(new Error(`The processed ${label.toLowerCase()} is still too large. Crop the image and try again.`));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function prepareLogoImage(file: File): Promise<string> {
  return prepareImage(file, { label: 'Logo image', maxDimension: 1_000 });
}

export function prepareProfileImage(file: File): Promise<string> {
  return prepareImage(file, { label: 'Profile photo', maxDimension: 720 });
}
