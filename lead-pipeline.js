import dns from 'node:dns/promises';
import fs from 'node:fs/promises';

// Usage:
// node lead-pipeline.js
// node lead-pipeline.js 200
// node lead-pipeline.js momox
// node lead-pipeline.js momox.de --debug

const argv = process.argv.slice(2);
const DEBUG = argv.includes('--debug');
const input = argv.filter(x => x !== '--debug').join(' ').trim();
const numericInput = /^\d+$/.test(input);
const TARGET = input && !numericInput ? input : null;
const SCAN_LIMIT = numericInput ? Number.parseInt(input, 10) : 50;

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const COMPANY_DELAY_MS = 1000;
const SLUG_DELAY_MS = 750;
const TIMEOUT_MS = 15000;
const OUTPUT_FILE = 'qualified-leads.json';
const HISTORY_FILE = 'scanned-history.json';
const USER_AGENT = 'PersonioLeadScanner/4.0';
const DACH = ['Q183', 'Q40', 'Q39'];

const ERROR_MARKERS = [
  'unauthorized_client',
  'tenant_not_found',
  'unknown_client',
  'invalid_client',
  'company_not_found',
  'company not found',
  'account does not exist',
  'tenant does not exist',
  'unknown tenant',
  'invalid tenant',
];

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function loadJson(file, fallback) {
  try {
    const text = await fs.readFile(file, 'utf8');

    return text.trim()
      ? JSON.parse(text)
      : fallback;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(
        `⚠️ ${file} konnte nicht gelesen werden: ${error.message}`,
      );
    }

    return fallback;
  }
}

async function saveJson(file, data) {
  const temp = `${file}.tmp`;

  await fs.writeFile(
    temp,
    JSON.stringify(data, null, 2),
    'utf8',
  );

  await fs.rename(temp, file);
}

function normalizeDomain(value) {
  if (!value) {
    return null;
  }

  try {
    const text = String(value).trim();

    const url = new URL(
      text.includes('://')
        ? text
        : `https://${text}`,
    );

    return url.hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/\.$/, '');
  } catch {
    return null;
  }
}

function looksLikeDomain(value) {
  return (
    typeof value === 'string' &&
    !value.includes(' ') &&
    /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)
  );
}

function normalizeName(value) {
  const umlauts = {
    ä: 'ae',
    ö: 'oe',
    ü: 'ue',
    ß: 'ss',
  };

  return String(value ?? '')
    .toLowerCase()
    .replace(
      /[äöüß]/g,
      char => umlauts[char],
    )
    .replace(/&/g, ' und ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

const compact = value =>
  normalizeName(value).replace(/[^a-z0-9]/g, '');

function toSlug(value, withDashes = true) {
  let slug = normalizeName(value)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();

  slug = withDashes
    ? slug
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
    : slug.replace(/[\s-]+/g, '');

  return slug.replace(/^-|-$/g, '');
}

function validSlug(slug) {
  return (
    typeof slug === 'string' &&
    slug.length >= 3 &&
    slug.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)
  );
}

function hasErrorMarker(value) {
  const text = String(value ?? '')
    .toLowerCase();

  return ERROR_MARKERS.some(marker =>
    text.includes(marker),
  );
}

async function wikidataSparql(query) {
  const url =
    'https://query.wikidata.org/sparql' +
    `?query=${encodeURIComponent(query)}` +
    '&format=json';

  const response = await fetch(url, {
    headers: {
      Accept:
        'application/sparql-results+json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Wikidata HTTP ${response.status}`,
    );
  }

  return response.json();
}

function companyFromBinding(binding, source) {
  const domain = normalizeDomain(
    binding.website.value,
  );

  if (!domain) {
    return null;
  }

  return {
    wikidataId:
      binding.company.value
        .split('/')
        .pop(),

    name:
      binding.companyLabel.value,

    domain,

    website:
      binding.website.value,

    country:
      binding.countryLabel?.value ??
      'Unbekannt',

    source,
  };
}

async function fetchDACHCompanies(
  limit,
  offset,
) {
  console.log(
    `📡 Wikidata: LIMIT ${limit}, OFFSET ${offset}`,
  );

  const countries = DACH
    .map(id => `wd:${id}`)
    .join(' ');

  const query = `
    SELECT DISTINCT
      ?company
      ?companyLabel
      ?website
      ?countryLabel
    WHERE {
      VALUES ?country {
        ${countries}
      }

      ?company wdt:P31 wd:Q4830453;
               wdt:P17 ?country;
               wdt:P856 ?website.

      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "de,en".
      }
    }
    ORDER BY ?company
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const data =
    await wikidataSparql(query);

  return data.results.bindings
    .map(binding =>
      companyFromBinding(
        binding,
        'wikidata-batch',
      ),
    )
    .filter(Boolean);
}

async function searchWikidataCompanies(
  searchTerm,
) {
  const searchUrl =
    'https://www.wikidata.org/w/api.php' +
    '?action=wbsearchentities' +
    `&search=${encodeURIComponent(searchTerm)}` +
    '&language=de' +
    '&uselang=de' +
    '&type=item' +
    '&limit=10' +
    '&format=json' +
    '&origin=*';

  const response = await fetch(searchUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Wikidata-Suche HTTP ${response.status}`,
    );
  }

  const searchData =
    await response.json();

  const ids = (
    searchData.search ?? []
  )
    .map(item => item.id)
    .filter(id => /^Q\d+$/.test(id));

  if (!ids.length) {
    return [];
  }

  const companies = ids
    .map(id => `wd:${id}`)
    .join(' ');

  const countries = DACH
    .map(id => `wd:${id}`)
    .join(' ');

  const query = `
    SELECT DISTINCT
      ?company
      ?companyLabel
      ?website
      ?countryLabel
    WHERE {
      VALUES ?company {
        ${companies}
      }

      VALUES ?country {
        ${countries}
      }

      ?company wdt:P17 ?country;
               wdt:P856 ?website.

      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "de,en".
      }
    }
  `;

  const data =
    await wikidataSparql(query);

  return data.results.bindings
    .map(binding =>
      companyFromBinding(
        binding,
        'wikidata-search',
      ),
    )
    .filter(Boolean);
}

function scoreCompany(
  company,
  searchTerm,
) {
  const search =
    compact(searchTerm);

  const name =
    compact(company.name);

  const domain = compact(
    company.domain
      ?.split('.')[0] ?? '',
  );

  let score = 0;

  if (name === search) {
    score += 100;
  } else if (
    name.startsWith(search)
  ) {
    score += 80;
  } else if (
    name.includes(search)
  ) {
    score += 60;
  }

  if (domain === search) {
    score += 100;
  } else if (
    domain.startsWith(search)
  ) {
    score += 75;
  } else if (
    domain.includes(search)
  ) {
    score += 50;
  }

  return score;
}

async function resolveTargetCompany(
  searchTerm,
) {
  if (
    looksLikeDomain(searchTerm)
  ) {
    const domain =
      normalizeDomain(searchTerm);

    return {
      wikidataId: null,
      name:
        domain.split('.')[0],
      domain,
      website:
        `https://${domain}`,
      country:
        'Unbekannt',
      source:
        'direct-domain',
    };
  }

  console.log(
    `🔎 Suche „${searchTerm}“ in Wikidata …`,
  );

  const companies =
    await searchWikidataCompanies(
      searchTerm,
    );

  if (!companies.length) {
    return {
      wikidataId: null,
      name: searchTerm,
      domain: null,
      website: null,
      country: 'Unbekannt',
      source: 'name-fallback',
    };
  }

  companies.sort(
    (a, b) =>
      scoreCompany(
        b,
        searchTerm,
      ) -
      scoreCompany(
        a,
        searchTerm,
      ),
  );

  return companies[0];
}

function nameSlugCandidates(name) {
  const normalized =
    normalizeName(name);

  const noLegal = normalized
    .replace(
      /\b(gmbh|ag|ug|se|kg|ohg|gbr|mbh|ev|e v|ltd|limited|inc|holding|gruppe|group|company|co)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  const words = toSlug(
    noLegal,
    true,
  )
    .split('-')
    .filter(Boolean);

  return [
    toSlug(
      normalized,
      true,
    ),

    toSlug(
      normalized,
      false,
    ),

    toSlug(
      noLegal,
      true,
    ),

    toSlug(
      noLegal,
      false,
    ),

    words
      .slice(0, 3)
      .join('-'),

    words
      .slice(0, 3)
      .join(''),

    words
      .slice(0, 2)
      .join('-'),

    words
      .slice(0, 2)
      .join(''),

    words[0],
  ];
}

function generatePersonioSlugs(
  companyName,
  domain,
  originalInput = null,
) {
  const candidates =
    new Set();

  if (domain) {
    const label = domain
      .split('.')[0]
      .toLowerCase();

    candidates.add(label);

    candidates.add(
      label.replace(/-/g, ''),
    );
  }

  nameSlugCandidates(
    companyName,
  ).forEach(value =>
    candidates.add(value),
  );

  if (originalInput) {
    if (
      looksLikeDomain(
        originalInput,
      )
    ) {
      const label =
        normalizeDomain(
          originalInput,
        )?.split('.')[0];

      if (label) {
        candidates.add(label);

        candidates.add(
          label.replace(/-/g, ''),
        );
      }
    } else {
      nameSlugCandidates(
        originalInput,
      ).forEach(value =>
        candidates.add(value),
      );
    }
  }

  return [...candidates]
    .map(value =>
      value?.toLowerCase(),
    )
    .filter(Boolean)
    .filter(validSlug);
}

async function checkPersonioSlug(
  slug,
) {
  const requestUrl =
    `https://${slug}.app.personio.com/`;

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      requestUrl,
      {
        method: 'GET',
        redirect: 'follow',
        signal:
          controller.signal,

        headers: {
          Accept:
            'text/html,application/xhtml+xml',

          'User-Agent':
            USER_AGENT,
        },
      },
    );

    const finalUrl =
      new URL(response.url);

    const organization =
      finalUrl.searchParams.get(
        'organization',
      );

    const organizationName =
      finalUrl.searchParams.get(
        'organization_name',
      );

    const hasOrganization =
      organization?.startsWith(
        'org_',
      ) &&
      Boolean(
        organizationName,
      );

    const isPersonioHost =
      finalUrl.hostname ===
        'www.personio.com' ||
      finalUrl.hostname ===
        'login.personio.com' ||
      finalUrl.hostname ===
        `${slug}.app.personio.com`;

    const hasError =
      finalUrl.searchParams.has(
        'error',
      ) ||
      finalUrl.searchParams.has(
        'error_description',
      ) ||
      hasErrorMarker(
        finalUrl.href,
      );

    /*
     * HTTP 429 ist kein negativer Treffer,
     * wenn Personio bereits eine gültige
     * organization zurückgegeben hat.
     */
    const isMatch = Boolean(
      isPersonioHost &&
      hasOrganization &&
      !hasError,
    );

    if (DEBUG || TARGET) {
      console.log(
        `          Request: ${requestUrl}`,
      );

      console.log(
        `          HTTP: ${response.status}`,
      );

      console.log(
        `          Finale URL: ${finalUrl.href}`,
      );

      console.log(
        `          Organization: ${
          organization ??
          'keine'
        }`,
      );

      console.log(
        `          Organization Name: ${
          organizationName ??
          'keiner'
        }`,
      );

      console.log(
        `          Rate-Limit: ${
          response.status === 429
            ? 'ja'
            : 'nein'
        }`,
      );

      console.log(
        `          Fehlerhinweis: ${
          hasError
            ? 'ja'
            : 'nein'
        }`,
      );

      console.log(
        `          Ergebnis: ${
          isMatch
            ? 'TREFFER'
            : 'kein Treffer'
        }`,
      );
    }

    if (!isMatch) {
      return null;
    }

    return {
      slug,

      personioUrl:
        `https://${slug}.app.personio.com`,

      legacyUrl:
        `https://${slug}.personio.de`,

      loginUrl:
        finalUrl.href,

      organization,

      organizationName,

      status:
        response.status,

      rateLimited:
        response.status === 429,

      detectedVia:
        'organization-parameter',
    };
  } catch (error) {
    if (DEBUG || TARGET) {
      console.log(
        `          Request: ${requestUrl}`,
      );

      console.log(
        `          Fehler: ${
          error.name ===
          'AbortError'
            ? 'Timeout'
            : error.message
        }`,
      );
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkPersonio(slugs) {
  for (
    let index = 0;
    index < slugs.length;
    index += 1
  ) {
    const slug =
      slugs[index];

    console.log(
      `       → Prüfe Slug: ${slug}`,
    );

    const match =
      await checkPersonioSlug(
        slug,
      );

    if (match) {
      return match;
    }

    if (
      index <
      slugs.length - 1
    ) {
      await sleep(
        SLUG_DELAY_MS,
      );
    }
  }

  return null;
}

async function checkDNS(domain) {
  const result = {
    workspace:
      'Unknown',

    mxRecords:
      [],

    spfIncludes:
      [],
  };

  if (!domain) {
    return result;
  }

  try {
    const mx =
      await dns.resolveMx(domain);

    result.mxRecords = mx
      .sort(
        (a, b) =>
          a.priority -
          b.priority,
      )
      .map(
        record =>
          record.exchange,
      );

    const text =
      result.mxRecords
        .join(' ')
        .toLowerCase();

    if (
      text.includes(
        'google.com',
      ) ||
      text.includes(
        'googlemail.com',
      )
    ) {
      result.workspace =
        'Google';
    } else if (
      text.includes(
        'outlook.com',
      ) ||
      text.includes(
        'protection.outlook.com',
      ) ||
      text.includes(
        'microsoft',
      )
    ) {
      result.workspace =
        'Microsoft';
    }
  } catch {
    // Keine MX-Daten.
  }

  try {
    const txt =
      await dns.resolveTxt(
        domain,
      );

    const spf = txt
      .map(parts =>
        parts.join(''),
      )
      .find(value =>
        value
          .toLowerCase()
          .startsWith(
            'v=spf1',
          ),
      );

    if (spf) {
      result.spfIncludes = [
        ...spf.matchAll(
          /include:([^\s]+)/gi,
        ),
      ].map(
        match =>
          match[1],
      );
    }
  } catch {
    // Keine TXT-/SPF-Daten.
  }

  return result;
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(entry => {
      if (
        typeof entry ===
        'string'
      ) {
        return entry
          .toLowerCase();
      }

      return entry
        ?.domain
        ?.toLowerCase();
    })
    .filter(Boolean);
}

function leadKey(lead) {
  if (lead?.domain) {
    return (
      `domain:${lead.domain.toLowerCase()}`
    );
  }

  if (
    lead?.personioSlug
  ) {
    return (
      `slug:${lead.personioSlug.toLowerCase()}`
    );
  }

  return null;
}

function deduplicateLeads(value) {
  const map =
    new Map();

  if (!Array.isArray(value)) {
    return [];
  }

  for (const lead of value) {
    const key =
      leadKey(lead);

    if (key) {
      map.set(
        key,
        lead,
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function upsertLead(
  leads,
  newLead,
) {
  const key =
    leadKey(newLead);

  const index =
    leads.findIndex(
      lead =>
        leadKey(lead) ===
        key,
    );

  if (index >= 0) {
    leads[index] =
      newLead;
  } else {
    leads.push(newLead);
  }
}

async function scanCompany(
  company,
  originalInput = null,
) {
  console.log('');

  console.log(
    `🔍 Prüfe: ${company.name}`,
  );

  console.log(
    `   Domain: ${
      company.domain ??
      'nicht gefunden'
    }`,
  );

  console.log(
    `   Land: ${company.country}`,
  );

  const slugs =
    generatePersonioSlugs(
      company.name,
      company.domain,
      originalInput,
    );

  console.log(
    `   Slugs: ${slugs.join(', ')}`,
  );

  const match =
    await checkPersonio(
      slugs,
    );

  if (!match) {
    console.log(
      '   ❌ Kein Personio-Tenant gefunden',
    );

    return null;
  }

  console.log(
    `   ✅ Personio gefunden: ${match.personioUrl}`,
  );

  console.log(
    `   🏢 Organization: ${match.organization}`,
  );

  console.log(
    `   🏷️ Organization Name: ${match.organizationName}`,
  );

  const dnsData =
    await checkDNS(
      company.domain,
    );

  return {
    company:
      company.name,

    domain:
      company.domain,

    website:
      company.website,

    country:
      company.country,

    wikidataId:
      company.wikidataId,

    source:
      company.source,

    personioSlug:
      match.slug,

    personioUrl:
      match.personioUrl,

    personioLegacyUrl:
      match.legacyUrl,

    personioLoginUrl:
      match.loginUrl,

    personioOrganization:
      match.organization,

    personioOrganizationName:
      match.organizationName,

    personioRateLimited:
      match.rateLimited,

    personioDetectedVia:
      match.detectedVia,

    workspace:
      dnsData.workspace,

    mxRecords:
      dnsData.mxRecords,

    spfIntegrations:
      dnsData.spfIncludes,

    scannedAt:
      new Date()
        .toISOString(),
  };
}

async function runTargetScan(
  searchTerm,
  history,
  leads,
) {
  console.log(
    '\n🚀 Starte gezielten Firmen-Scan',
  );

  console.log(
    `🎯 Suche: ${searchTerm}\n`,
  );

  let company;

  try {
    company =
      await resolveTargetCompany(
        searchTerm,
      );
  } catch (error) {
    console.error(
      `❌ Firmensuche fehlgeschlagen: ${error.message}`,
    );

    const domain =
      looksLikeDomain(
        searchTerm,
      )
        ? normalizeDomain(
            searchTerm,
          )
        : null;

    company = {
      wikidataId:
        null,

      name:
        domain
          ?.split('.')[0] ??
        searchTerm,

      domain,

      website:
        domain
          ? `https://${domain}`
          : null,

      country:
        'Unbekannt',

      source:
        'fallback',
    };
  }

  console.log(
    `🏢 Gefunden: ${company.name}`,
  );

  if (company.domain) {
    console.log(
      `🌐 Website: ${company.domain}`,
    );
  }

  if (
    company.domain &&
    history.has(
      company.domain
        .toLowerCase(),
    )
  ) {
    console.log(
      '📜 Bereits früher gescannt; wird trotzdem erneut geprüft.',
    );
  }

  const lead =
    await scanCompany(
      company,
      searchTerm,
    );

  if (company.domain) {
    history.add(
      company.domain
        .toLowerCase(),
    );
  }

  if (lead) {
    upsertLead(
      leads,
      lead,
    );

    await saveJson(
      OUTPUT_FILE,
      leads,
    );
  }

  await saveJson(
    HISTORY_FILE,
    [...history].sort(),
  );

  console.log(
    '\n========================================',
  );

  console.log(
    '🎯 FIRMEN-SCAN ABGESCHLOSSEN',
  );

  console.log(
    lead
      ? `✅ Personio-Treffer: ${lead.personioUrl}`
      : '❌ Kein Personio-Treffer gefunden',
  );

  console.log(
    '========================================',
  );
}

async function runBatchScan(
  history,
  leads,
) {
  console.log(
    '\n🚀 Starte automatischen Personio-Lead-Scanner',
  );

  console.log(
    `🎯 Ziel: ${SCAN_LIMIT} neue Unternehmen`,
  );

  console.log(
    `📜 Bereits gescannt: ${history.size}`,
  );

  console.log(
    `💾 Gespeicherte Personio-Leads: ${leads.length}\n`,
  );

  let scanned = 0;
  let matches = 0;
  let offset = 0;

  for (
    let page = 0;
    page < MAX_PAGES &&
    scanned < SCAN_LIMIT;
    page += 1
  ) {
    let companies;

    try {
      companies =
        await fetchDACHCompanies(
          PAGE_SIZE,
          offset,
        );
    } catch (error) {
      console.error(
        `❌ Wikidata-Fehler: ${error.message}`,
      );

      break;
    }

    if (!companies.length) {
      break;
    }

    for (
      const company
      of companies
    ) {
      if (
        scanned >=
        SCAN_LIMIT
      ) {
        break;
      }

      const domain =
        company.domain
          .toLowerCase();

      if (
        history.has(domain)
      ) {
        continue;
      }

      scanned += 1;

      console.log(
        `\n[${scanned}/${SCAN_LIMIT}]`,
      );

      const lead =
        await scanCompany(
          company,
        );

      if (lead) {
        upsertLead(
          leads,
          lead,
        );

        matches += 1;

        await saveJson(
          OUTPUT_FILE,
          leads,
        );
      }

      history.add(domain);

      await saveJson(
        HISTORY_FILE,
        [...history].sort(),
      );

      if (
        scanned <
        SCAN_LIMIT
      ) {
        await sleep(
          COMPANY_DELAY_MS,
        );
      }
    }

    offset +=
      PAGE_SIZE;
  }

  await saveJson(
    HISTORY_FILE,
    [...history].sort(),
  );

  await saveJson(
    OUTPUT_FILE,
    leads,
  );

  console.log(
    '\n========================================',
  );

  console.log(
    '🎯 WORKFLOW ABGESCHLOSSEN',
  );

  console.log(
    `📊 Neu gescannt: ${scanned}`,
  );

  console.log(
    `✅ Neue Treffer: ${matches}`,
  );

  console.log(
    `💾 Leads insgesamt: ${leads.length}`,
  );

  console.log(
    `📜 Historie insgesamt: ${history.size}`,
  );

  console.log(
    '========================================',
  );
}

async function main() {
  const history =
    new Set(
      normalizeHistory(
        await loadJson(
          HISTORY_FILE,
          [],
        ),
      ),
    );

  const leads =
    deduplicateLeads(
      await loadJson(
        OUTPUT_FILE,
        [],
      ),
    );

  for (const lead of leads) {
    if (lead.domain) {
      history.add(
        lead.domain
          .toLowerCase(),
      );
    }
  }

  await saveJson(
    HISTORY_FILE,
    [...history].sort(),
  );

  await saveJson(
    OUTPUT_FILE,
    leads,
  );

  if (TARGET) {
    await runTargetScan(
      TARGET,
      history,
      leads,
    );
  } else {
    await runBatchScan(
      history,
      leads,
    );
  }
}

main().catch(error => {
  console.error(
    '\n❌ Unerwarteter Fehler:',
  );

  console.error(error);

  process.exitCode = 1;
});
