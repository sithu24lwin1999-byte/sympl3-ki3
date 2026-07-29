# Profile photo fields

This migration documents optional profile photo fields added to existing tenant data.

## Added fields

- `shops/{shopId}.ownerPhoto`: optimized data URL for the shop owner's profile photo.
- `shops/{shopId}/employees/{employeeId}.photo`: optimized data URL for the employee profile photo.
- `users/{uid}.photo`: optimized data URL mirrored for employee login/profile display.

Images are validated in the browser as PNG, JPG or WebP, limited to 3 MB before processing, converted to WebP and compressed before storage.

No backfill is required. Missing values are treated as empty and the UI falls back to initials.
