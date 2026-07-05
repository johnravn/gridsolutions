/**
 * Storybook-only Supabase mock for LogoUpload / CompanyLogoUpload stories.
 */

const PLACEHOLDER_LOGO =
  'https://placehold.co/400x200/indigo/white?text=Logo&font=source-sans-pro'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createStorageBucket() {
  return {
    getPublicUrl(path: string) {
      return {
        data: {
          publicUrl: `${PLACEHOLDER_LOGO}&path=${encodeURIComponent(path)}`,
        },
      }
    },
    async upload(
      _path: string,
      _file: File,
      _options?: { upsert?: boolean; contentType?: string },
    ) {
      await delay(400)
      return { data: { path: _path }, error: null }
    },
    async remove(_paths: Array<string>) {
      await delay(200)
      return { data: null, error: null }
    },
  }
}

export const supabase = {
  storage: {
    from(_bucket: string) {
      return createStorageBucket()
    },
  },
}
