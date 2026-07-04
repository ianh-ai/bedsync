export interface CatalogEntry {
  id: string;
  name: string;
  brand: string;
  url: string;
  variantFilter?: string;
  apiProductName?: string;
}

export interface CatalogBrand {
  displayName: string;
  slug: string;
  products: CatalogEntry[];
}

export const CATALOG: CatalogBrand[] = [
  {
    displayName: 'Helix', slug: 'helix',
    products: [
      { id: 'helix-midnight-luxe', name: 'Midnight Luxe', brand: 'helix', url: 'https://helixsleep.com/products/midnight-luxe' },
      { id: 'helix-twilight-luxe', name: 'Twilight Luxe', brand: 'helix', url: 'https://helixsleep.com/products/midnight-luxe' },
      { id: 'helix-sunset-luxe', name: 'Sunset Luxe', brand: 'helix', url: 'https://helixsleep.com/products/midnight-luxe' },
      { id: 'helix-moonlight-luxe', name: 'Moonlight Luxe', brand: 'helix', url: 'https://helixsleep.com/products/midnight-luxe' },
      { id: 'helix-dusk-luxe', name: 'Dusk Luxe', brand: 'helix', url: 'https://helixsleep.com/products/midnight-luxe' },
      { id: 'helix-dawn-luxe', name: 'Dawn Luxe', brand: 'helix', url: 'https://helixsleep.com/products/midnight-luxe' },
      { id: 'helix-plus-luxe', name: 'Plus Luxe', brand: 'helix', url: 'https://helixsleep.com/products/midnight-luxe' },
      { id: 'helix-sunset-core', name: 'Sunset Core', brand: 'helix', url: 'https://helixsleep.com/products/midnight' },
      { id: 'helix-midnight-core', name: 'Midnight Core', brand: 'helix', url: 'https://helixsleep.com/products/midnight' },
      { id: 'helix-twilight-core', name: 'Twilight Core', brand: 'helix', url: 'https://helixsleep.com/products/midnight' },
      { id: 'helix-moonlight-core', name: 'Moonlight Core', brand: 'helix', url: 'https://helixsleep.com/products/midnight' },
      { id: 'helix-dusk-core', name: 'Dusk Core', brand: 'helix', url: 'https://helixsleep.com/products/midnight' },
      { id: 'helix-dawn-core', name: 'Dawn Core', brand: 'helix', url: 'https://helixsleep.com/products/midnight' },
      { id: 'helix-plus-core', name: 'Plus Core', brand: 'helix', url: 'https://helixsleep.com/products/midnight' },
      { id: 'helix-midnight-elite', name: 'Midnight Elite', brand: 'helix', url: 'https://helixsleep.com/products/midnight-elite' },
      { id: 'helix-twilight-elite', name: 'Twilight Elite', brand: 'helix', url: 'https://helixsleep.com/products/midnight-elite' },
      { id: 'helix-sunset-elite', name: 'Sunset Elite', brand: 'helix', url: 'https://helixsleep.com/products/midnight-elite' },
      { id: 'helix-moonlight-elite', name: 'Moonlight Elite', brand: 'helix', url: 'https://helixsleep.com/products/midnight-elite' },
      { id: 'helix-dusk-elite', name: 'Dusk Elite', brand: 'helix', url: 'https://helixsleep.com/products/midnight-elite' },
      { id: 'helix-dawn-elite', name: 'Dawn Elite', brand: 'helix', url: 'https://helixsleep.com/products/midnight-elite' },
      { id: 'helix-plus-elite', name: 'Plus Elite', brand: 'helix', url: 'https://helixsleep.com/products/midnight-elite' },
    ],
  },
  {
    displayName: 'Bear', slug: 'bear',
    products: [
      { id: 'bear-elite-hybrid', name: 'Elite Hybrid', brand: 'bear', url: 'https://www.bearmattress.com/products/elite-hybrid-mattress' },
      { id: 'bear-elite-ultra-hybrid', name: 'Elite Ultra Hybrid', brand: 'bear', url: 'https://www.bearmattress.com/products/elite-ultra-hybrid-mattress' },
      { id: 'bear-pro-foam', name: 'Pro Foam', brand: 'bear', url: 'https://www.bearmattress.com/products/pro-foam-mattress' },
      { id: 'bear-pro-hybrid', name: 'Pro Hybrid', brand: 'bear', url: 'https://www.bearmattress.com/products/pro-hybrid-mattress' },
      { id: 'bear-original', name: 'Original', brand: 'bear', url: 'https://www.bearmattress.com/products/bear-original-mattress' },
      { id: 'bear-original-hybrid', name: 'Original Hybrid', brand: 'bear', url: 'https://www.bearmattress.com/products/bear-original-hybrid-mattress' },
    ],
  },
  {
    displayName: 'Avocado', slug: 'avocado',
    products: [
      { id: 'avocado-green-medium', name: 'Green Medium Tight Top', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/green-natural-organic-mattress', variantFilter: 'medium' },
      { id: 'avocado-green-firm', name: 'Green Firm Tight Top', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/green-natural-organic-mattress', variantFilter: 'firm' },
      { id: 'avocado-green-plush', name: 'Green Plush Pillow Top', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/green-natural-organic-mattress', variantFilter: 'plush' },
      { id: 'avocado-eco-organic', name: 'Eco Organic', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/best-organic-affordable-mattress-eco-organic' },
      { id: 'avocado-luxury-medium', name: 'Luxury Organic Medium Tight Top', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/natural-organic-luxury-plush-mattress', variantFilter: 'medium' },
      { id: 'avocado-luxury-plush', name: 'Luxury Organic Plush Pillow Top', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/natural-organic-luxury-plush-mattress', variantFilter: 'plush' },
      { id: 'avocado-luxury-ultra-plush', name: 'Luxury Organic Ultra Plush Box Top', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/natural-organic-luxury-plush-mattress', variantFilter: 'ultra plush' },
      { id: 'avocado-extra-firm', name: 'Extra Firm Mattress', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/extra-firm-mattress' },
      { id: 'avocado-green-ultra-plush', name: 'Green Ultra Plush Box Top', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/green-ultra-plush-mattress' },
      { id: 'avocado-vegan', name: 'Vegan Mattress', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/avocado-vegan-mattress' },
      { id: 'avocado-wool', name: 'Wool Mattress', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/avocado-wool-mattress' },
      { id: 'avocado-latex', name: 'Latex Mattress', brand: 'avocado', url: 'https://www.avocadogreenmattress.com/products/organic-latex-foam-mattress' },
    ],
  },
  {
    displayName: 'Puffy', slug: 'puffy',
    products: [
      { id: 'puffy-cloud', name: 'Cloud Mattress', brand: 'puffy', url: 'https://puffy.com/products/puffy-mattress' },
      { id: 'puffy-lux', name: 'Lux Mattress', brand: 'puffy', url: 'https://puffy.com/products/puffy-lux-mattress' },
      { id: 'puffy-royal', name: 'Royal Mattress', brand: 'puffy', url: 'https://puffy.com/products/puffy-royal-mattress' },
      { id: 'puffy-monarch', name: 'Monarch Mattress', brand: 'puffy', url: 'https://puffy.com/products/puffy-monarch-mattress' },
      { id: 'puffy-legacy', name: 'Legacy Mattress', brand: 'puffy', url: 'https://puffy.com/products/puffy-legacy-mattress' },
    ],
  },
  {
    displayName: 'Nectar', slug: 'nectar',
    products: [
      { id: 'nectar-classic-foam', name: 'Classic Memory Foam', brand: 'nectar', url: 'https://www.nectarsleep.com/mattress', apiProductName: 'nectar-51-classic-foam-mattress' },
      { id: 'nectar-classic-hybrid', name: 'Classic Hybrid', brand: 'nectar', url: 'https://www.nectarsleep.com/mattresses/hybrid-mattress' },
      { id: 'nectar-premier-foam', name: 'Premier Memory Foam', brand: 'nectar', url: 'https://www.nectarsleep.com/mattresses/premier-memory-foam-mattress' },
      { id: 'nectar-premier-hybrid', name: 'Premier Hybrid', brand: 'nectar', url: 'https://www.nectarsleep.com/mattresses/premier-hybrid-mattress' },
      { id: 'nectar-luxe-foam', name: 'Luxe Memory Foam', brand: 'nectar', url: 'https://www.nectarsleep.com/mattresses/luxe-memory-foam-mattress' },
      { id: 'nectar-luxe-hybrid', name: 'Luxe Hybrid', brand: 'nectar', url: 'https://www.nectarsleep.com/mattresses/luxe-hybrid-mattress' },
      { id: 'nectar-ultra-foam', name: 'Ultra Memory Foam', brand: 'nectar', url: 'https://www.nectarsleep.com/mattresses/ultra-memory-foam-mattress' },
      { id: 'nectar-ultra-hybrid', name: 'Ultra Hybrid', brand: 'nectar', url: 'https://www.nectarsleep.com/mattresses/ultra-hybrid-mattress' },
    ],
  },
  {
    displayName: 'Casper', slug: 'casper',
    products: [
      { id: 'casper-the-one', name: 'The One', brand: 'casper', url: 'https://casper.com/products/casper-one-foam?variant=41670971261009' },
      { id: 'casper-cloud-one', name: 'Cloud One', brand: 'casper', url: 'https://casper.com/products/casper-cloud-one-foam?variant=51926050701678' },
      { id: 'casper-dream', name: 'Dream', brand: 'casper', url: 'https://casper.com/products/casper-dream-hybrid?variant=41611237949521' },
      { id: 'casper-snow', name: 'Snow', brand: 'casper', url: 'https://casper.com/products/casper-snow-v3?variant=41670971949137' },
      { id: 'casper-dream-max', name: 'Dream Max', brand: 'casper', url: 'https://casper.com/products/casper-dream-max-hybrid?variant=41670972178513' },
      { id: 'casper-snow-max', name: 'Snow Max', brand: 'casper', url: 'https://casper.com/products/casper-snow-max-hybrid-v3?variant=41670972407889' },
    ],
  },
  {
    displayName: 'Brooklyn Bedding', slug: 'brooklynbedding',
    products: [
      { id: 'bb-copperflex-foam', name: 'Copper Flex Memory Foam', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/copperflex-hybrid-12?variant=44513167540269' },
      { id: 'bb-copperflex-hybrid', name: 'Copper Flex Hybrid', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/copperflex-hybrid-12?variant=44513169473581' },
      { id: 'bb-copperflex-pro-foam', name: 'Copper Flex Pro Memory Foam', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/copperflex-pro-hybrid-14?variant=44513170128941' },
      { id: 'bb-copperflex-pro-hybrid', name: 'Copper Flex Pro Hybrid', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/copperflex-pro-hybrid-14?variant=44513170161709' },
      { id: 'bb-signature-hybrid', name: 'Signature Hybrid', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/signature-hybrid?variant=44510100783149' },
      { id: 'bb-signature-cloud', name: 'Signature Cloud Hybrid', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/signature-hybrid?variant=44510100684845' },
      { id: 'bb-aurora-luxe', name: 'Aurora Luxe', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/aurora?variant=44513190740013' },
      { id: 'bb-aurora-luxe-cloud', name: 'Aurora Luxe Cloud', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/aurora?variant=44513190707245' },
      { id: 'bb-thermobalance', name: 'ThermoBalance', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/thermobalance?variant=44539254177837' },
      { id: 'bb-thermobalance-elite', name: 'ThermoBalance Elite', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/thermobalance-elite?variant=44539265843245' },
      { id: 'bb-thermobalance-lx', name: 'ThermoBalance LX', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/thermobalance-lx?variant=44620727713837' },
      { id: 'bb-thermobalance-lx-elite', name: 'ThermoBalance LX Elite', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/thermobalance-lx-elite?variant=44620728500269' },
      { id: 'bb-titan-plus-luxe', name: 'Titan Plus Luxe', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/titan-luxe-hybrid?variant=40397025902637' },
      { id: 'bb-titan-plus-elite', name: 'Titan Plus Elite', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/titan-elite?variant=42921063743533' },
      { id: 'bb-plank-firm-luxe', name: 'Plank Firm Luxe', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/plank-hybrid?variant=40397034946605' },
      { id: 'bb-plank-firm', name: 'Plank Firm', brand: 'brooklynbedding', url: 'https://brooklynbedding.com/products/plank?variant=40397033078829' },
    ],
  },
  {
    displayName: 'Dreamcloud', slug: 'dreamcloud',
    products: [
      { id: 'dreamcloud-classic-hybrid', name: 'Classic Hybrid', brand: 'dreamcloud', url: 'https://www.dreamcloudsleep.com/mattress', apiProductName: 'dreamcloud-40-classic-hybrid-mattress' },
      { id: 'dreamcloud-classic-foam', name: 'Classic Memory Foam', brand: 'dreamcloud', url: 'https://www.dreamcloudsleep.com/mattresses/memory-foam-mattress' },
      { id: 'dreamcloud-premier-hybrid', name: 'Premier Hybrid', brand: 'dreamcloud', url: 'https://www.dreamcloudsleep.com/mattresses/premier-hybrid-mattress' },
      { id: 'dreamcloud-premier-foam', name: 'Premier Memory Foam', brand: 'dreamcloud', url: 'https://www.dreamcloudsleep.com/mattresses/premier-memory-foam-mattress' },
      { id: 'dreamcloud-luxe-hybrid', name: 'Luxe Hybrid', brand: 'dreamcloud', url: 'https://www.dreamcloudsleep.com/mattresses/luxe-hybrid-mattress' },
      { id: 'dreamcloud-luxe-foam', name: 'Luxe Memory Foam', brand: 'dreamcloud', url: 'https://www.dreamcloudsleep.com/mattresses/luxe-memory-foam-mattress' },
      { id: 'dreamcloud-ultra-hybrid', name: 'Ultra Hybrid', brand: 'dreamcloud', url: 'https://www.dreamcloudsleep.com/mattresses/ultra-hybrid-mattress' },
      { id: 'dreamcloud-ultra-foam', name: 'Ultra Memory Foam', brand: 'dreamcloud', url: 'https://www.dreamcloudsleep.com/mattresses/ultra-memory-foam-mattress', apiProductName: 'dreamcloud-40-ultra-foam-mattress' },
      { id: 'dreamcloud-pressure-smart', name: 'Pressure Smart', brand: 'dreamcloud', url: 'https://www.dreamcloudsleep.com/mattresses/pressuresmart-firm-mattress' },
    ],
  },
  {
    displayName: 'Naturepedic', slug: 'naturepedic',
    products: [
      { id: 'naturepedic-serenade', name: 'Serenade Organic Hybrid', brand: 'naturepedic', url: 'https://www.naturepedic.com/serenade-organic-mattress-buy?475=1153' },
      { id: 'naturepedic-concerto', name: 'Concerto Plush Pillow Top Organic', brand: 'naturepedic', url: 'https://www.naturepedic.com/concerto-organic-pillowtop-mattress-buy' },
      { id: 'naturepedic-eos-classic', name: 'EOS Classic Customizable Organic', brand: 'naturepedic', url: 'https://www.naturepedic.com/eos-classic-organic-mattress-buy' },
      { id: 'naturepedic-eos-pillowtop', name: 'EOS Organic Pillow Top', brand: 'naturepedic', url: 'https://www.naturepedic.com/eos-pillowtop-organic-mattress-buy' },
      { id: 'naturepedic-eos-trilux', name: 'EOS Trilux Organic', brand: 'naturepedic', url: 'https://www.naturepedic.com/eos-trilux-organic-mattress-buy' },
    ],
  },
  {
    displayName: 'Birch', slug: 'birch',
    products: [
      { id: 'birch-luxe-natural', name: 'Luxe Natural', brand: 'birch', url: 'https://birchliving.com/products/birch-luxe-natural-mattress' },
      { id: 'birch-elite-natural', name: 'Elite Natural', brand: 'birch', url: 'https://birchliving.com/products/birch-elite-natural-mattress' },
      { id: 'birch-natural', name: 'Natural', brand: 'birch', url: 'https://birchliving.com/products/birch-natural-organic-mattress' },
      { id: 'birch-essential', name: 'Essential', brand: 'birch', url: 'https://birchliving.com/products/birch-essential-mattress' },
    ],
  },
  {
    displayName: 'MLily', slug: 'mlily',
    products: [
{ id: 'mlily-wellflex-ice', name: 'WellFlex ICE', brand: 'mlily', url: 'https://mlilyusa.com/collections/memory-foam/products/wellflex-ice-memory-foam-mattress' },
      { id: 'mlily-wellflex', name: 'WellFlex', brand: 'mlily', url: 'https://mlilyusa.com/collections/memory-foam/products/wellflex-memory-foam-mattress' },
      { id: 'mlily-chiropro', name: 'ChiroPro Tri Zoned Hybrid', brand: 'mlily', url: 'https://mlilyusa.com/collections/hybrid-mattresses/products/chiropro-tri-zoned-hybrid-mattress' },
      { id: 'mlily-midnight-ice-hybrid', name: 'Midnight Ice Hybrid', brand: 'mlily', url: 'https://mlilyusa.com/collections/hybrid-mattresses/products/midnight-ice-hybrid-mattress' },
      { id: 'mlily-midnight-hybrid', name: 'Midnight Hybrid', brand: 'mlily', url: 'https://mlilyusa.com/collections/hybrid-mattresses/products/midnight-hybrid-mattress' },
    ],
  },
  {
    displayName: 'Tempur-Pedic', slug: 'tempurpedic',
    products: [
      { id: 'tempur-cloud-foam', name: 'Cloud Memory Foam', brand: 'tempurpedic', url: 'https://www.tempurpedic.com/shop-mattresses/tempur-cloud-mattress/' },
      { id: 'tempur-adapt', name: 'Adapt', brand: 'tempurpedic', url: 'https://www.tempurpedic.com/shop-mattresses/adapt-collection/v/4120/' },
      { id: 'tempur-pro-adapt', name: 'Pro Adapt', brand: 'tempurpedic', url: 'https://www.tempurpedic.com/shop-mattresses/adapt-collection/v/4186/' },
      { id: 'tempur-luxe-adapt', name: 'Luxe Adapt', brand: 'tempurpedic', url: 'https://www.tempurpedic.com/shop-mattresses/adapt-collection/v/4201/' },
      { id: 'tempur-probreeze', name: 'ProBreeze', brand: 'tempurpedic', url: 'https://www.tempurpedic.com/shop-mattresses/breeze-collection/v/3934/' },
      { id: 'tempur-luxebreeze', name: 'LuxeBreeze', brand: 'tempurpedic', url: 'https://www.tempurpedic.com/shop-mattresses/breeze-collection/v/3947/' },
      { id: 'tempur-activebreeze', name: 'ActiveBreeze', brand: 'tempurpedic', url: 'https://www.tempurpedic.com/shop-mattresses/tempur-active-breeze/v/4154/' },
    ],
  },
  {
    displayName: 'WinkBed', slug: 'winkbeds',
    products: [
      { id: 'winkbed-luxury-firm', name: 'Luxury Firm', brand: 'winkbeds', url: 'https://www.winkbeds.com/products/the-luxury-firm-winkbed' },
      { id: 'winkbed-softer', name: 'Softer', brand: 'winkbeds', url: 'https://www.winkbeds.com/products/the-luxury-firm-winkbed' },
      { id: 'winkbed-firmer', name: 'Firmer', brand: 'winkbeds', url: 'https://www.winkbeds.com/products/the-luxury-firm-winkbed' },
      { id: 'winkbed-plus', name: 'Plus', brand: 'winkbeds', url: 'https://www.winkbeds.com/products/the-plus-winkbed' },
      { id: 'winkbed-gravitylux-soft', name: 'Gravity Lux Soft', brand: 'winkbeds', url: 'https://www.winkbeds.com/products/the-gravitylux-medium' },
      { id: 'winkbed-gravitylux-medium', name: 'Gravity Lux Medium', brand: 'winkbeds', url: 'https://www.winkbeds.com/products/the-gravitylux-medium' },
      { id: 'winkbed-gravitylux-firm', name: 'Gravity Lux Firm', brand: 'winkbeds', url: 'https://www.winkbeds.com/products/the-gravitylux-firm' },
      { id: 'winkbed-ecocloud', name: 'EcoCloud', brand: 'winkbeds', url: 'https://www.winkbeds.com/products/the-ecocloud' },
    ],
  },
  {
    displayName: 'Leesa', slug: 'leesa',
    products: [
      { id: 'leesa-original-foam', name: 'Original Memory Foam', brand: 'leesa', url: 'https://www.leesa.com/products/leesa-mattress' },
      { id: 'leesa-original-hybrid', name: 'Original Hybrid', brand: 'leesa', url: 'https://www.leesa.com/products/original-hybrid-mattress' },
      { id: 'leesa-sapira-hybrid', name: 'Sapira Hybrid', brand: 'leesa', url: 'https://www.leesa.com/products/leesa-hybrid-mattress' },
      { id: 'leesa-sapira-chill', name: 'Sapira Chill Hybrid', brand: 'leesa', url: 'https://www.leesa.com/products/sapira-chill-mattress' },
      { id: 'leesa-legend-hybrid', name: 'Legend Hybrid', brand: 'leesa', url: 'https://www.leesa.com/products/leesa-legend-mattress' },
      { id: 'leesa-reserve-hybrid', name: 'Reserve Hybrid', brand: 'leesa', url: 'https://www.leesa.com/products/reserve-hybrid-mattress' },
      { id: 'leesa-oasis-chill', name: 'Oasis Chill Hybrid', brand: 'leesa', url: 'https://www.leesa.com/products/oasis-chill-hybrid-mattress' },
      { id: 'leesa-legend-chill', name: 'Legend Chill Hybrid', brand: 'leesa', url: 'https://www.leesa.com/products/legend-chill-hybrid-mattress' },
      { id: 'leesa-natural-hybrid', name: 'Natural Hybrid', brand: 'leesa', url: 'https://www.leesa.com/products/natural-hybrid-mattress' },
      { id: 'leesa-plus-hybrid', name: 'Plus Hybrid', brand: 'leesa', url: 'https://www.leesa.com/products/plus-hybrid-mattress' },
    ],
  },
];
