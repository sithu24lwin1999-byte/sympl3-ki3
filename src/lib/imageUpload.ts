const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_LOGO_FILE_BYTES = 3 * 1024 * 1024;
const MAX_STORED_DATA_URL_LENGTH = 700_000;

export function validateLogoFile(file: Pick<File, 'type' | 'size'>) {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > MAX_LOGO_FILE_BYTES) throw new Error('Logo image must be 3 MB or smaller.');
}

export function prepareLogoImage(file: File): Promise<string> {
  validateLogoFile(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the logo image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('The selected logo image is invalid.'));
      image.onload = () => {
        const scale = Math.min(1, 1_000 / Math.max(image.width, image.height));
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
        reject(new Error('The processed logo is still too large. Crop the image and try again.'));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
