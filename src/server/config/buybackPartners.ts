
export interface BuybackPartner {
  slug: string
  name: string
  website: string
  logo: string
  description: string
  descriptionDe: string
  contactEmail: string | null
  minQuantity: number
  supportedCategories: string[]
  certifications: string[]
  estimateMethod: 'manual' | 'api'
  region: string
  highlights: string[]
  highlightsDe: string[]
  founded?: string
  employees?: string
  volumePerYear?: string
  active: boolean
}

export const BUYBACK_PARTNERS: BuybackPartner[] = [
  {
    slug: 'foxway',
    name: 'Foxway',
    website: 'https://foxway.com',
    logo: 'https://foxway.com/favicon.ico',
    description: 'Europe\'s largest circular IT platform. Buys devices from enterprises and carriers, provides certified data wiping, and remarkets globally.',
    descriptionDe: 'Europas größte Circular-IT-Plattform. Kauft Geräte von Unternehmen und Mobilfunkanbietern, bietet zertifizierte Datenlöschung und globale Wiedervermarktung.',
    contactEmail: 'buyback@foxway.com',
    minQuantity: 10,
    supportedCategories: ['laptop', 'phone', 'tablet', 'desktop', 'monitor', 'smartwatch'],
    certifications: ['ADISA', 'R2', 'ISO 14001', 'ISO 27001', 'Blancco'],
    estimateMethod: 'manual',
    region: 'EU-wide',
    highlights: [
      'Largest EU circular IT platform',
      'White-label buyback API available',
      'Certified data destruction (ADISA)'
    ],
    highlightsDe: [
      'Größte EU Circular-IT-Plattform',
      'White-Label Buyback-API verfügbar',
      'Zertifizierte Datenlöschung (ADISA)'
    ],
    founded: '2009',
    employees: '1,400+',
    volumePerYear: '4M+ devices',
    active: true
  },
  {
    slug: 'afb-group',
    name: 'AfB Social & Green IT',
    website: 'https://afb-group.eu',
    logo: 'https://afb-group.eu/favicon.ico',
    description: 'Social enterprise and certified ITAD provider. Specializes in refurbishing IT equipment from corporations with a focus on sustainability and disability inclusion.',
    descriptionDe: 'Sozialunternehmen und zertifizierter ITAD-Partner. Spezialisiert auf die Aufbereitung von Unternehmens-IT mit Fokus auf Nachhaltigkeit und Inklusion.',
    contactEmail: 'partner@afb-group.eu',
    minQuantity: 20,
    supportedCategories: ['laptop', 'desktop', 'phone', 'tablet', 'monitor'],
    certifications: ['Blancco Platinum', 'ISO 14001', 'EMAS', 'B Corp'],
    estimateMethod: 'manual',
    region: 'DACH + EU',
    highlights: [
      'Social enterprise (disability inclusion)',
      'Blancco Platinum ITAD Partner',
      'Free pickup for 20+ devices'
    ],
    highlightsDe: [
      'Sozialunternehmen (Inklusion)',
      'Blancco Platinum ITAD Partner',
      'Kostenlose Abholung ab 20 Geräten'
    ],
    founded: '2004',
    employees: '500+',
    active: true
  },
  {
    slug: 'bb-net',
    name: 'bb-net media',
    website: 'https://bb-net.de',
    logo: 'https://bb-net.de/favicon.ico',
    description: 'German IT remarketing specialist. Buys corporate IT hardware in bulk, refurbishes under the "tecXL" brand. BSI-certified data destruction.',
    descriptionDe: 'Deutscher IT-Remarketing-Spezialist. Kauft Unternehmens-Hardware in großen Mengen, refurbisht unter der Marke "tecXL". BSI-zertifizierte Datenlöschung.',
    contactEmail: 'ankauf@bb-net.de',
    minQuantity: 20,
    supportedCategories: ['laptop', 'desktop', 'monitor', 'phone', 'tablet'],
    certifications: ['BSI', 'Blancco', 'ISO 9001', 'ISO 14001', 'ISO 27001'],
    estimateMethod: 'manual',
    region: 'Germany + EU',
    highlights: [
      'BSI-certified data destruction',
      '"tecXL" refurbished brand',
      'Triple ISO certified (9001/14001/27001)'
    ],
    highlightsDe: [
      'BSI-zertifizierte Datenlöschung',
      '"tecXL" Refurbished-Marke',
      'Dreifach ISO-zertifiziert (9001/14001/27001)'
    ],
    founded: '2003',
    active: true
  },

  {
    slug: 'teclot',
    name: 'TecLot',
    website: 'https://teclot.de',
    logo: 'https://teclot.de/favicon.ico',
    description: 'Munich-based B2B wholesale specialist for refurbished smartphones. Buys in bulk from enterprises and resells to retailers across Europe.',
    descriptionDe: 'Münchner B2B-Großhandelsspezialist für refurbished Smartphones. Kauft in großen Mengen von Unternehmen und verkauft an Fachhändler in ganz Europa.',
    contactEmail: 'ankauf@teclot.de',
    minQuantity: 50,
    supportedCategories: ['phone', 'tablet', 'smartwatch'],
    certifications: ['WEEE', 'Blancco'],
    estimateMethod: 'manual',
    region: 'EU-wide',
    highlights: [
      '50,000+ smartphones processed yearly',
      'Specialized in smartphones & tablets',
      'Europe-wide logistics network'
    ],
    highlightsDe: [
      '50.000+ Smartphones jährlich verarbeitet',
      'Spezialisiert auf Smartphones & Tablets',
      'Europaweites Logistiknetzwerk'
    ],
    founded: '2017',
    volumePerYear: '50,000+ devices',
    active: true
  },
  {
    slug: 'recommerce',
    name: 'Recommerce',
    website: 'https://recommerce.com',
    logo: 'https://recommerce.com/favicon.ico',
    description: 'European trade-in platform with API-driven device buyback. Operates programs for OEMs and carriers with automated grading.',
    descriptionDe: 'Europäische Trade-in-Plattform mit API-gestütztem Geräteankauf. Betreibt Programme für OEMs und Carrier mit automatisiertem Grading.',
    contactEmail: 'partners@recommerce.com',
    minQuantity: 10,
    supportedCategories: ['phone', 'tablet'],
    certifications: ['R2', 'ISO 14001'],
    estimateMethod: 'manual',
    region: 'EU-wide',
    highlights: [
      'Trade-in API for integrations',
      'OEM & carrier partnerships',
      'Automated device grading'
    ],
    highlightsDe: [
      'Trade-in API für Integrationen',
      'OEM- & Carrier-Partnerschaften',
      'Automatisiertes Geräte-Grading'
    ],
    active: true
  },
  {
    slug: 'mobile-depot',
    name: 'Mobile Depot Europe',
    website: 'https://mobiledepot.eu',
    logo: 'https://mobiledepot.eu/favicon.ico',
    description: 'Leading European B2B mobile phone wholesaler. Delivers tested used devices to resellers in 60+ countries. Based in France with NL operations.',
    descriptionDe: 'Führender europäischer B2B-Handy-Großhändler. Liefert geprüfte Gebrauchtgeräte an Reseller in 60+ Ländern.',
    contactEmail: null,
    minQuantity: 100,
    supportedCategories: ['phone', 'tablet'],
    certifications: ['R2', 'WEEE'],
    estimateMethod: 'manual',
    region: 'EU-wide (60+ countries)',
    highlights: [
      'Delivers to 60+ countries',
      'Active since 1999',
      'High volume B2B specialist'
    ],
    highlightsDe: [
      'Lieferung in 60+ Länder',
      'Aktiv seit 1999',
      'Hochvolumen B2B-Spezialist'
    ],
    founded: '1999',
    active: true
  },

  {
    slug: 'rebuy-business',
    name: 'rebuy for Business',
    website: 'https://www.rebuy.de/business',
    logo: 'https://www.rebuy.de/favicon.ico',
    description: 'B2B buyback arm of rebuy.de. Accepts individual devices or bulk lots from companies. Instant price estimates via web platform.',
    descriptionDe: 'B2B-Ankaufsbereich von rebuy.de. Akzeptiert einzelne Geräte oder Großmengen von Unternehmen. Sofortige Preisschätzung über Webplattform.',
    contactEmail: null,
    minQuantity: 1,
    supportedCategories: ['phone', 'tablet', 'laptop'],
    certifications: ['TÜV', 'Blancco'],
    estimateMethod: 'manual',
    region: 'Germany',
    highlights: [
      'No minimum quantity',
      '36-month warranty on resold devices',
      'Instant online price calculator'
    ],
    highlightsDe: [
      'Keine Mindestmenge',
      '36 Monate Garantie auf weiterverkaufte Geräte',
      'Sofortiger Online-Preiskalkulator'
    ],
    active: true
  },
  {
    slug: 'janado',
    name: 'Janado',
    website: 'https://janado.de',
    logo: 'https://janado.de/favicon.ico',
    description: 'German refurbished device dealer. Buys used electronics from businesses and consumers, resells as certified refurbished.',
    descriptionDe: 'Deutscher Refurbished-Händler. Kauft gebrauchte Elektronik von Unternehmen und Verbrauchern, verkauft als zertifiziert aufbereitet.',
    contactEmail: null,
    minQuantity: 5,
    supportedCategories: ['phone', 'tablet', 'laptop'],
    certifications: ['Blancco'],
    estimateMethod: 'manual',
    region: 'Germany',
    highlights: [
      'B2C and B2B channels',
      'Quick turnaround on pricing',
      'German-based operations'
    ],
    highlightsDe: [
      'B2C- und B2B-Kanäle',
      'Schnelle Preisfindung',
      'Standort Deutschland'
    ],
    active: true
  },
  {
    slug: 'myswooop',
    name: 'mySWOOOP',
    website: 'https://myswooop.de',
    logo: 'https://myswooop.de/favicon.ico',
    description: 'German tech buyback platform. Purchases used electronics from businesses and private sellers. Automated kiosk-based and online trade-in.',
    descriptionDe: 'Deutsche Tech-Ankauf-Plattform. Kauft gebrauchte Elektronik von Unternehmen und Privatpersonen. Automatisierter Kiosk- und Online-Trade-in.',
    contactEmail: null,
    minQuantity: 1,
    supportedCategories: ['phone', 'tablet', 'laptop', 'smartwatch'],
    certifications: ['TÜV'],
    estimateMethod: 'manual',
    region: 'Germany',
    highlights: [
      'Automated trade-in kiosks',
      'No minimum quantity',
      'Instant price quotes'
    ],
    highlightsDe: [
      'Automatisierte Trade-in Kioske',
      'Keine Mindestmenge',
      'Sofortige Preisangebote'
    ],
    active: true
  },
  {
    slug: 'used-phone',
    name: 'Used Phone (b2b-handys.de)',
    website: 'https://b2b-handys.de',
    logo: 'https://b2b-handys.de/favicon.ico',
    description: 'Bavarian wholesaler for used, refurbished, and repaired smartphones. Supplies retailers across Europe.',
    descriptionDe: 'Bayerischer Großhändler für gebrauchte, aufbereitete und reparierte Smartphones. Beliefert Fach- und Einzelhändler europaweit.',
    contactEmail: null,
    minQuantity: 20,
    supportedCategories: ['phone'],
    certifications: ['WEEE'],
    estimateMethod: 'manual',
    region: 'Germany + EU',
    highlights: [
      'Smartphone-only specialist',
      'Bavarian quality standards',
      'Europe-wide distribution'
    ],
    highlightsDe: [
      'Reiner Smartphone-Spezialist',
      'Bayerische Qualitätsstandards',
      'Europaweiter Vertrieb'
    ],
    active: true
  }
]

export function getActiveBuybackPartners(): BuybackPartner[] {
  return BUYBACK_PARTNERS.filter(p => p.active)
}

export function getBuybackPartnerBySlug(slug: string): BuybackPartner | undefined {
  return BUYBACK_PARTNERS.find(p => p.slug === slug && p.active)
}
