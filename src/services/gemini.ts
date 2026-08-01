import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export async function getMarketPrices(hardware: { manufacturer: string; model: string }): Promise<{
  rawResponse: string;
  prices: Array<{
    price: number;
    source: string;
    url: string;
  }>;
}> {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `Search for the 3 LOWEST CURRENT prices with direct product links for a ${hardware.manufacturer} ${hardware.model} from DIFFERENT marketplaces.

  ONLY use these specific marketplaces:
  - rebuy.de
  - refurbed.de
  - backmarket.de

  IMPORTANT RULES:
  1. Each price MUST be from a different marketplace
  2. Only return actual prices you find, NO price estimation
  3. Each price MUST include the FULL product URL
  4. Prices MUST be between 400€ and 3000€
  5. Return ONLY the 3 lowest prices with their URLs
  6. VERIFY that each URL actually exists and leads to the exact product
  7. DO NOT make up or estimate prices

  DO NOT GENERATE ANY LINKS DO NOT GENERATE ANY PRICES DO REAL SEARCHES TO FIND THE LOWESt PRICES


  EXAMPLE VALID LINK : https://www.backmarket.de/de-de/p/macbook-air-13-2022-m2-mit-8core-cpu-und-16gb-ram-ssd-1000gb-qwertz-deutsch/1614635f-75f7-4c90-8be5-047c8dc4e4b3?shopping=gmc&utm_source=google&utm_medium=cpc&utm_campaign=DE_SA_SHOP_G_GEN_MacBook_RSC&gclid=CjwKCAiAtYy9BhBcEiwANWQQLzJyuFQgN2riXM7XVUkavzmanh1kl4KJ4oWNlz6c_kFgraYssY0qThoCo6YQAvD_BwE&gad_source=1


ALL LINKS WHICH YOU HAVE GENERATED WERE NOT FOUND
  Example response format:
  849€ - rebuy.de - https://www.rebuy.de/...
  899€ - refurbed.de - https://www.refurbed.de/...
  929€ - backmarket.de - https://www.backmarket.de/...`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const prices = text.split('\n').map(line => {
      const match = line.match(/(\d+)€\s*-\s*([\w.]+)\s*-\s*(https?:\/\/[^\s]+)/);
      if (!match) return null;

      const [, priceStr, source, url] = match;
      const price = parseInt(priceStr);

      if (price < 400 || price > 3000) {
        console.warn(`Invalid price ${price}€ outside allowed range (400€-3000€)`);
        return null;
      }

      if (!url || !url.match(/^https?:\/\/(www\.)?(rebuy|refurbed|backmarket)\.de/)) {
        console.warn(`Invalid or missing URL for price ${price}€`);
        return null;
      }

      return { price, source, url };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      rawResponse: text,
      prices
    };
  } catch (error) {
    console.error('Error getting market prices:', error);
    return {
      rawResponse: error instanceof Error ? error.message : 'Unknown error occurred',
      prices: []
    };
  }
}
