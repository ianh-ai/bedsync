const BRAND_MAP: Record<string, string> = {
  'helixsleep.com': 'helix',
  'dreamcloudsleep.com': 'dreamcloud',
  'bearmattress.com': 'bear',
  'casper.com': 'casper',
  'nectarsleep.com': 'nectar',
  'puffy.com': 'puffy',
  'brooklynbedding.com': 'brooklyn-bedding',
  'birchliving.com': 'birch',
  'avocadogreenmattress.com': 'avocado',
  'mlily.com': 'mlily',
  'naturepedic.com': 'naturepedic',
  'winkbeds.com': 'winkbeds',
}

export function detectBrand(url: string): string | null {
  try {
    const { hostname } = new URL(url)
    const domain = hostname.replace(/^www\./, '')
    return BRAND_MAP[domain] ?? null
  } catch {
    return null
  }
}
