import { mkdir, writeFile } from 'node:fs/promises';

const USER_AGENT = 'Hermes NASA Mission Badge Archive Builder/1.0';
const OUTPUT_FILE = new URL('../src/data/missions.js', import.meta.url);
const BATCH_SIZE = 25;

const SOURCE_GROUPS = [
  {
    program: 'Mercury',
    titles: [
      'Mercury-Redstone 3',
      'Mercury-Redstone 4',
      'Mercury-Atlas 6',
      'Mercury-Atlas 7',
      'Mercury-Atlas 8',
      'Mercury-Atlas 9',
    ],
  },
  {
    program: 'Gemini',
    titles: [
      'Gemini 1',
      'Gemini 2',
      'Gemini 3',
      'Gemini 4',
      'Gemini 5',
      'Gemini 6A',
      'Gemini 7',
      'Gemini 8',
      'Gemini 9A',
      'Gemini 10',
      'Gemini 11',
      'Gemini 12',
    ],
  },
  {
    program: 'Apollo',
    titles: [
      'Apollo 1',
      'Apollo 4',
      'Apollo 5',
      'Apollo 6',
      'Apollo 7',
      'Apollo 8',
      'Apollo 9',
      'Apollo 10',
      'Apollo 11',
      'Apollo 12',
      'Apollo 13',
      'Apollo 14',
      'Apollo 15',
      'Apollo 16',
      'Apollo 17',
      'Apollo-Soyuz Test Project',
    ],
  },
  {
    program: 'Skylab',
    titles: ['Skylab 2', 'Skylab 3', 'Skylab 4'],
  },
  {
    program: 'Artemis',
    titles: ['Artemis I', 'Artemis II', 'Artemis III', 'Artemis IV'],
  },
  {
    program: 'Commercial Crew',
    titles: [
      'SpaceX Demo-2',
      'Boeing Crew Flight Test',
      'SpaceX Crew-1',
      'SpaceX Crew-2',
      'SpaceX Crew-3',
      'SpaceX Crew-4',
      'SpaceX Crew-5',
      'SpaceX Crew-6',
      'SpaceX Crew-7',
      'SpaceX Crew-8',
      'SpaceX Crew-9',
      'SpaceX Crew-10',
      'SpaceX Crew-11',
      'SpaceX Crew-12',
    ],
  },
];

const CATEGORY_SOURCES = [
  {
    program: 'Space Shuttle',
    category: 'Category:Space_Shuttle_missions',
    include: (title) => /^STS-/.test(title),
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value = '') {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{nbsp\}\}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function chunk(array, size) {
  const output = [];
  for (let index = 0; index < array.length; index += size) {
    output.push(array.slice(index, index + size));
  }
  return output;
}

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json',
    },
  });

  if (response.status === 429 && attempt < 8) {
    await sleep(600 * attempt);
    return fetchJson(url, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

async function getCategoryMembers(category) {
  const titles = [];
  let cursor = null;

  while (true) {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'categorymembers');
    url.searchParams.set('cmtitle', category);
    url.searchParams.set('cmlimit', '500');
    url.searchParams.set('format', 'json');
    if (cursor) url.searchParams.set('cmcontinue', cursor);

    const payload = await fetchJson(url);
    const members = payload?.query?.categorymembers ?? [];
    titles.push(...members.map((member) => member.title));

    cursor = payload?.continue?.cmcontinue ?? null;
    if (!cursor) break;
  }

  return titles;
}

async function buildMissionCatalog() {
  const catalog = [];

  for (const group of SOURCE_GROUPS) {
    for (const title of group.titles) catalog.push({ title, program: group.program });
  }

  for (const source of CATEGORY_SOURCES) {
    const titles = await getCategoryMembers(source.category);
    for (const title of titles.filter(source.include).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
      catalog.push({ title, program: source.program });
    }
  }

  return [...new Map(catalog.map((item) => [item.title, item])).values()];
}

async function fetchWikitextMap(titles) {
  const map = new Map();

  for (const group of chunk(titles, BATCH_SIZE)) {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('prop', 'revisions');
    url.searchParams.set('rvprop', 'content');
    url.searchParams.set('rvslots', 'main');
    url.searchParams.set('titles', group.join('|'));
    url.searchParams.set('redirects', '1');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');

    const payload = await fetchJson(url);
    const aliasMap = new Map((payload?.query?.redirects ?? []).map((entry) => [entry.from, entry.to]));

    for (const page of payload?.query?.pages ?? []) {
      const text = page?.revisions?.[0]?.slots?.main?.content ?? '';
      map.set(page.title, text);
      for (const requestedTitle of group) {
        if (aliasMap.get(requestedTitle) === page.title) map.set(requestedTitle, text);
      }
    }

    await sleep(150);
  }

  return map;
}

async function fetchSummaryMap(titles) {
  const map = new Map();

  for (const group of chunk(titles, BATCH_SIZE)) {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('prop', 'extracts|description');
    url.searchParams.set('exintro', '1');
    url.searchParams.set('explaintext', '1');
    url.searchParams.set('titles', group.join('|'));
    url.searchParams.set('redirects', '1');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');

    const payload = await fetchJson(url);
    const aliasMap = new Map((payload?.query?.redirects ?? []).map((entry) => [entry.from, entry.to]));

    for (const page of payload?.query?.pages ?? []) {
      const summary = {
        description: cleanText(page.description || ''),
        extract: cleanText(page.extract || ''),
        wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      };
      map.set(page.title, summary);
      for (const requestedTitle of group) {
        if (aliasMap.get(requestedTitle) === page.title) map.set(requestedTitle, summary);
      }
    }

    await sleep(150);
  }

  return map;
}

function extractTemplateValue(wikitext, fields) {
  const lines = wikitext.split('\n');
  for (const field of fields) {
    const pattern = new RegExp(`^\\s*\\|\\s*${field}\\s*=\\s*(.+)$`, 'i');
    for (const line of lines) {
      const match = line.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }
  return '';
}

function normalizeFileName(value) {
  return value.replace(/^(?:File|Image):/i, '').replace(/_/g, ' ').trim();
}

function extractFileName(value) {
  if (!value) return null;

  const linkedFile = value.match(/\[\[(?:File|Image):([^|\]]+)/i);
  if (linkedFile?.[1]) return normalizeFileName(linkedFile[1]);

  const plainFile = value.match(/((?:File:)?[^\[\]|]+\.(?:svg|png|jpg|jpeg|webp))/i);
  if (plainFile?.[1]) return normalizeFileName(plainFile[1]);

  return null;
}

function extractFallbackPatchFile(wikitext) {
  const matches = [...wikitext.matchAll(/\[\[(?:File|Image):([^|\]]+)/gi)].map((match) => normalizeFileName(match[1]));
  return matches.find((name) => /patch|insignia|logo|emblem/i.test(name)) || null;
}

function extractLaunchDate(value) {
  if (!value) return { launchDate: '', year: null };

  const templateDate = value.match(/\{\{[^}]*?\|(\d{4})\|(\d{1,2})\|(\d{1,2})/);
  if (templateDate) {
    const [, year, month, day] = templateDate;
    return {
      launchDate: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      year: Number(year),
    };
  }

  const fallbackYear = value.match(/(19|20)\d{2}/);
  return {
    launchDate: fallbackYear?.[0] ?? '',
    year: fallbackYear ? Number(fallbackYear[0]) : null,
  };
}

async function fetchImageMapForWiki(baseUrl, fileNames) {
  const map = new Map();
  const uniqueNames = [...new Set(fileNames.filter(Boolean))];

  for (const group of chunk(uniqueNames, BATCH_SIZE)) {
    const url = new URL(baseUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url');
    url.searchParams.set('iiurlwidth', '720');
    url.searchParams.set('titles', group.map((name) => `File:${name}`).join('|'));
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');

    const payload = await fetchJson(url);
    for (const page of payload?.query?.pages ?? []) {
      const imageinfo = page?.imageinfo?.[0];
      if (!imageinfo?.url) continue;
      map.set(page.title.replace(/^File:/, ''), {
        image: imageinfo.thumburl || imageinfo.url,
        originalImage: imageinfo.url,
        descriptionUrl: imageinfo.descriptionurl,
      });
    }

    await sleep(150);
  }

  return map;
}

async function fetchAllImageMaps(fileNames) {
  const commonsMap = await fetchImageMapForWiki('https://commons.wikimedia.org/w/api.php', fileNames);
  const missing = fileNames.filter((name) => name && !commonsMap.has(name));
  const enwikiMap = missing.length
    ? await fetchImageMapForWiki('https://en.wikipedia.org/w/api.php', missing)
    : new Map();

  const combined = new Map(commonsMap);
  for (const [name, value] of enwikiMap.entries()) combined.set(name, value);
  return combined;
}

function inferEra(program, year) {
  if (program === 'Mercury' || program === 'Gemini') return 'Origins';
  if (program === 'Apollo' || program === 'Skylab') return 'Moonshot';
  if (program === 'Space Shuttle') return 'Shuttle Era';
  if (program === 'Artemis') return 'Return to the Moon';
  if (program === 'Commercial Crew') return 'Commercial Crew';
  if (year && year >= 2000) return 'Modern NASA';
  return 'NASA Missions';
}

const missions = await buildMissionCatalog();
const titles = missions.map((mission) => mission.title);

console.log(`Collecting wikitext for ${titles.length} missions...`);
const wikitextMap = await fetchWikitextMap(titles);
console.log('Collecting summaries...');
const summaryMap = await fetchSummaryMap(titles);

const fileNames = [];
for (const mission of missions) {
  const wikitext = wikitextMap.get(mission.title) || '';
  const insigniaValue = extractTemplateValue(wikitext, ['insignia', 'mission_patch', 'patch', 'badge']);
  const fileName = extractFileName(insigniaValue) || extractFallbackPatchFile(wikitext);
  if (fileName) fileNames.push(fileName);
}

console.log(`Collecting image metadata for ${new Set(fileNames).size} patch files...`);
const commonsMap = await fetchAllImageMaps(fileNames);

const completed = [];
const skipped = [];

for (const mission of missions) {
  const wikitext = wikitextMap.get(mission.title) || '';
  const summary = summaryMap.get(mission.title) || {
    description: '',
    extract: '',
    wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(mission.title.replace(/ /g, '_'))}`,
  };
  const insigniaValue = extractTemplateValue(wikitext, ['insignia', 'mission_patch', 'patch', 'badge']);
  const fileName = extractFileName(insigniaValue) || extractFallbackPatchFile(wikitext);

  if (!fileName) {
    skipped.push({ title: mission.title, reason: 'No recognizable mission patch file found' });
    continue;
  }

  const imageData = commonsMap.get(fileName);
  if (!imageData) {
    skipped.push({ title: mission.title, reason: `No Commons image metadata for ${fileName}` });
    continue;
  }

  const launchMeta = extractLaunchDate(extractTemplateValue(wikitext, ['launch_date', 'launch date']));

  completed.push({
    id: titleToSlug(mission.title),
    title: mission.title,
    program: mission.program,
    era: inferEra(mission.program, launchMeta.year),
    year: launchMeta.year,
    launchDate: launchMeta.launchDate,
    description: summary.description,
    extract: summary.extract,
    patchFile: fileName,
    image: imageData.image,
    originalImage: imageData.originalImage,
    descriptionUrl: imageData.descriptionUrl,
    wikipediaUrl: summary.wikipediaUrl,
  });
}

completed.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title, undefined, { numeric: true }));

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(
  OUTPUT_FILE,
  `export const missions = ${JSON.stringify(completed, null, 2)};\n\nexport const skippedMissions = ${JSON.stringify(skipped, null, 2)};\n`,
  'utf8',
);

console.log(`Saved ${completed.length} missions to ${OUTPUT_FILE.pathname}`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length} missions:`);
  for (const entry of skipped) console.log(`- ${entry.title}: ${entry.reason}`);
}
