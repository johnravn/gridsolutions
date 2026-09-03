import { describe, expect, it } from 'vitest'
import { transformRemoteDataDump } from './transform-remote-data-dump.mjs'

describe('transformRemoteDataDump profiles upsert', () => {
  it('rewrites profiles INSERT to upsert stub rows from copy-auth', () => {
    const dump = `INSERT INTO "public"."profiles" ("user_id", "first_name", "phone", "created_at", "email", "display_name", "avatar_url", "locale", "timezone", "bio", "preferences", "superuser", "last_name", "selected_company_id", "primary_address_id", "last_seen_release_version") VALUES
	('e2b4f0f5-e9fd-4838-bdc9-610223232fe3', 'John', NULL, '2025-09-28 12:57:25.037455+00', 'john.ravndal@gmail.com', 'John Ravndal', 'e2b4f0f5/avatar.jpg', 'en', NULL, NULL, '{}', true, 'Ravndal', NULL, NULL, NULL);
`

    const result = transformRemoteDataDump(dump)

    expect(result.profilesUpsert).toBe(true)
    expect(result.sql).toContain('ON CONFLICT (user_id) DO UPDATE SET')
    expect(result.sql).toContain('avatar_url = EXCLUDED.avatar_url')
    expect(result.sql).toContain('superuser = EXCLUDED.superuser')
    expect(result.sql).toContain("'e2b4f0f5/avatar.jpg'")
  })

  it('leaves an existing profiles ON CONFLICT clause alone', () => {
    const dump = `INSERT INTO "public"."profiles" ("user_id", "email", "superuser") VALUES
	('e2b4f0f5-e9fd-4838-bdc9-610223232fe3', 'john.ravndal@gmail.com', true)
ON CONFLICT (user_id) DO NOTHING;
`

    const result = transformRemoteDataDump(dump)

    expect(result.profilesUpsert).toBe(false)
    expect(result.sql).toContain('ON CONFLICT (user_id) DO NOTHING')
    expect(result.sql).not.toContain('superuser = EXCLUDED.superuser')
  })
})
