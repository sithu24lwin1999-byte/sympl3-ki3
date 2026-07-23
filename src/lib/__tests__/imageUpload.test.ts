import { describe, expect, it } from 'vitest';
import { MAX_LOGO_FILE_BYTES, validateLogoFile } from '../imageUpload';

describe('logo upload validation', () => {
  it('accepts supported images up to 3 MB', () => {
    expect(() => validateLogoFile({ type: 'image/png', size: MAX_LOGO_FILE_BYTES })).not.toThrow();
    expect(() => validateLogoFile({ type: 'image/jpeg', size: 100 })).not.toThrow();
  });

  it('rejects unsupported files and images above 3 MB', () => {
    expect(() => validateLogoFile({ type: 'image/svg+xml', size: 100 })).toThrow('PNG, JPG or WebP');
    expect(() => validateLogoFile({ type: 'image/webp', size: MAX_LOGO_FILE_BYTES + 1 })).toThrow('3 MB');
  });
});
