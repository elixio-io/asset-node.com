import { onMounted, onUnmounted } from 'vue'

export function useBlogArticleSchema(options: {
  headline: string
  datePublished: string
  description: string
  slug: string
}) {
  let scriptEl: HTMLScriptElement | null = null

  onMounted(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: options.headline,
      datePublished: options.datePublished,
      dateModified: options.datePublished,
      description: options.description,
      url: `https://asset-node.com/blog/${options.slug}`,
      inLanguage: 'de-DE',
      author: {
        '@type': 'Organization',
        name: 'AssetNode',
        url: 'https://asset-node.com'
      },
      publisher: {
        '@type': 'Organization',
        name: 'AssetNode',
        url: 'https://asset-node.com',
        logo: {
          '@type': 'ImageObject',
          url: 'https://asset-node.com/assetnode-logo.svg'
        }
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://asset-node.com/blog/${options.slug}`
      }
    }

    scriptEl = document.createElement('script')
    scriptEl.type = 'application/ld+json'
    scriptEl.id = `article-schema-${options.slug}`
    scriptEl.textContent = JSON.stringify(schema)
    document.head.appendChild(scriptEl)
  })

  onUnmounted(() => {
    if (scriptEl && scriptEl.parentNode) {
      scriptEl.parentNode.removeChild(scriptEl)
    }
  })
}
