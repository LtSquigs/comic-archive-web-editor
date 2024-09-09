import ExifTransformer from 'exif-be-gone';
import { Readable, Transform } from 'stream';
import { CBZReader, CBZWriter } from './cbz.js';
import path from 'path';
import fs from 'fs';
import { APIKeys, APIMetadata } from './shared/types.js';
import { convert } from 'html-to-text';

export const SERVER_HOST = process.env.HOST ?? 'localhost';
export const SERVER_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
export const STATIC_PATH = 'public';
export const KEYS_FILE = '.scrape-keys.json';
export const SERVER_DIR = path.resolve(process.env.ARCHIVE_DIR ?? '/archives');
export const ALLOWED_EXTENSIONS = CBZReader.extensions;
export const REGISTERED_READERS = [CBZReader];
export const REGISTERED_WRITERS = [CBZWriter];

let keys: APIKeys = {};
let readKeys = false;

export const getKeys = (): APIKeys => {
  if (readKeys) return keys;
  readKeys = true;
  try {
    if (fs.existsSync(KEYS_FILE)) {
      keys = JSON.parse(fs.readFileSync(KEYS_FILE).toString());
    }

    for (let key in keys) {
      keys[key as keyof APIKeys] = keys[key as keyof APIKeys]?.trim();
    }
  } catch (e) {
    keys = {};
  }

  return keys;
};

getKeys();

export const saveKeys = (newKeys: APIKeys) => {
  keys = newKeys;
  for (let key in keys) {
    keys[key as keyof APIKeys] = keys[key as keyof APIKeys]?.trim();
  }
  fs.writeFileSync(KEYS_FILE, JSON.stringify(newKeys));
};

export const scrapeUrl = async (url: string): Promise<APIMetadata> => {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    throw new Error('Unable to parse url.');
  }

  const pathParts = parsedUrl.pathname.split('/');
  let id = null;

  switch (parsedUrl.host) {
    case 'comicvine.gamespot.com':
      id = parsedUrl.pathname.endsWith('/')
        ? pathParts[pathParts.length - 2]
        : pathParts[pathParts.length - 1];
      const idParse = id.match(/^(\d+)-(\d+)$/);

      if (!idParse) {
        throw new Error('Comic Vine Url format unknown.');
      }

      switch (idParse[1]) {
        case '4000':
          const [metadata, volumeUrl] = await scrapeComicVineIssue(
            `https://comicvine.gamespot.com/api/issue/${id}/`
          );
          let publisher = null;
          if (volumeUrl) {
            ({ publisher } = await scrapeComicVineVolume(volumeUrl));
          }

          return { publisher, ...metadata };
        case '4050':
          return scrapeComicVineVolume(
            `https://comicvine.gamespot.com/api/volume/${id}/`
          );
        default:
          throw new Error('Unsupported Comic Vine Type');
      }
    case 'myanimelist.net':
      const type = pathParts[0] === '' ? pathParts[1] : pathParts[0];
      id = parsedUrl.pathname.endsWith('/')
        ? pathParts[pathParts.length - 3]
        : pathParts[pathParts.length - 2];

      switch (type) {
        case 'manga':
          return scrapeMALManga(`https://api.myanimelist.net/v2/manga/${id}`);
        default:
          throw new Error('Unsupported MyAnimeList Type');
      }

      return {};
  }

  throw new Error('Unable to scrape from url.');
};

const creditsToList = (credits: any[]): string | null => {
  const creditString = credits
    .map((item: any) => item.name)
    .sort((a, b) => a.localeCompare(b, { sensitivity: 'base' }))
    .join(',');

  if (!creditString.trim()) {
    return null;
  }

  return creditString;
};

export const scrapeMALManga = async (url: string): Promise<APIMetadata> => {
  const params = new URLSearchParams();
  params.append(
    'fields',
    [
      'title',
      'start_date',
      'synopsis',
      'mean',
      'rank',
      'popularity',
      'genres',
      'media_type',
      'status',
      'num_volumes',
      'num_chapters',
      'authors{first_name,last_name}',
      'serialization{name}',
    ].join(',')
  );

  const resp = await fetch(url + `?${params.toString()}`, {
    headers: {
      'X-MAL-CLIENT-ID': keys.myanimelist || '',
    },
  });
  const data = await resp.json();

  if (data.error) {
    throw new Error(data.error);
  }

  let year = null;
  let month = null;
  let date = null;
  const dateMatch = data.start_date.match(/(\d+)-(\d+)-(\d+)/);
  if (dateMatch) {
    year = parseInt(dateMatch[1]);
    month = parseInt(dateMatch[2]);
    date = parseInt(dateMatch[3], 10);
  }

  const writers = (data.authors || [])
    .filter((author: any) => author.role.match(/story/i))
    .map((author: any) => author.node.first_name + ' ' + author.node.last_name)
    .join(',');

  const artists = (data.authors || [])
    .filter((author: any) => author.role.match(/art/i))
    .map((author: any) => author.node.first_name + ' ' + author.node.last_name)
    .join(',');

  const publishers = (data.serialization || [])
    .map((magazine: any) => magazine.node.name)
    .join(',');

  return {
    title: data.title,
    year,
    month,
    date,
    summary: data.synopsis,
    communityRating: data.mean || null,
    writer: writers || null,
    penciller: artists || null,
    genre:
      (data.genres || []).map((genre: any) => genre.name).join(',') || null,
    count: data.num_chapters,
    publisher: publishers || null,
  };
};

const personCreditsToList = (credits: any[], role: string): string | null => {
  return creditsToList(
    credits.filter((person: any) => (person.role || '').includes(role))
  );
};

export const scrapeComicVineIssue = async (
  url: string
): Promise<[APIMetadata, string | null]> => {
  const params = new URLSearchParams();
  params.append('api_key', keys.comicvine || '');
  params.append('format', 'json');

  const resp = await fetch(url + `?${params.toString()}`);
  const issueData = await resp.json();
  if (issueData.error && issueData.error !== 'OK') {
    throw new Error(issueData.error);
  }

  const issue = issueData.results;
  let volumeUrl = null;
  if (issue.volume && issue.volume.api_detail_url) {
    volumeUrl = issue.volume.api_detail_url;
  }

  const characters = creditsToList(issue.character_credits);
  const dateStr = issue.cover_date;
  const description = issue.description;
  const number = issue.issue_number;
  const locations = creditsToList(issue.location_credits);
  const name = issue.name;
  let writers = personCreditsToList(issue.person_credits, 'writer');
  let artists = personCreditsToList(issue.person_credits, 'artist');
  const letterers = personCreditsToList(issue.person_credits, 'letterer');
  const editors = personCreditsToList(issue.person_credits, 'editor');
  const cover = personCreditsToList(issue.person_credits, 'cover');
  const translators = personCreditsToList(issue.person_credits, 'translator');
  let pencillers = personCreditsToList(issue.person_credits, 'penciler ');
  let inkers = personCreditsToList(issue.person_credits, 'inker ');
  const colorists = personCreditsToList(issue.person_credits, 'colorist ');

  // If the length is exactly one lets assume this is the writer and artist
  if (issue.person_credits.length === 1) {
    writers = creditsToList(issue.person_credits);
    artists = creditsToList(issue.person_credits);
  }

  const storyArcs = creditsToList(issue.story_arc_credits);
  const teams = creditsToList(issue.team_credits);

  // Unsure of what to do with "artist", comicinfo is not really made for that
  if (!pencillers) {
    pencillers = artists;
  }

  let year = null;
  let month = null;
  let date = null;
  const dateMatch = dateStr.match(/(\d+)-(\d+)-(\d+)/);
  if (dateMatch) {
    year = parseInt(dateMatch[1]);
    month = parseInt(dateMatch[2]);
    date = parseInt(dateMatch[3], 10);
  }

  // date parse + html -> plaintext simplifier
  return [
    {
      characters,
      summary: convert(description, {
        wordwrap: null,
        limits: { maxInputLength: undefined },
      }),
      number,
      locations,
      title: name,
      storyArc: storyArcs,
      teams: teams,
      writer: writers,
      coverArtist: cover,
      editor: editors,
      letterer: letterers,
      translator: translators,
      penciller: pencillers,
      inker: inkers,
      colorist: colorists,
      year,
      month,
      date,
    },
    volumeUrl,
  ];
};

export const scrapeComicVineVolume = async (
  url: string
): Promise<APIMetadata> => {
  const params = new URLSearchParams();
  params.append('api_key', keys.comicvine || '');
  params.append('format', 'json');

  const resp = await fetch(url + `?${params.toString()}`);
  const volumeData = await resp.json();
  if (volumeData.error && volumeData.error !== 'OK') {
    throw new Error(volumeData.error);
  }

  const volume = volumeData.results;

  const description = volume.description;
  const name = volume.name;

  const publishers = volume.publisher ? volume.publisher.name : null;
  const start_year = volume.start_year;
  const locations = creditsToList(volume.locations);
  const characters = creditsToList(volume.characters);

  return {
    year: start_year,
    publisher: publishers,
    title: name,
    summary: convert(description),
    locations,
    characters,
  };
};

export const removeExif = (readable: Readable): Readable => {
  const transformer: Transform = new (ExifTransformer as any)();
  readable.pipe(transformer);
  return transformer;
};

export const getArchivesRelative = async (relativeDir: string) => {
  const normalized = path.join('/', relativeDir);
  const baseDir = path.join(SERVER_DIR, normalized);
  const pathTraversal = !baseDir.startsWith(SERVER_DIR);

  if (pathTraversal) {
    return [];
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  return entries
    .filter((entry) => {
      if (
        !entry.isDirectory() &&
        !ALLOWED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
      )
        return false;

      return true;
    })
    .map((entry) => {
      return {
        directory: entry.isDirectory(),
        name: entry.name,
        parentPath: entry.parentPath.replace(SERVER_DIR + path.sep, ''),
        path: path.join(
          entry.parentPath.replace(SERVER_DIR + path.sep, ''),
          entry.name
        ),
      };
    });
};

export const resolveFiles = (files: string[]) => {
  const fileNames = files
    .map((file) => {
      // Normalizes away path traversal
      const normalized = path.join('/', file);
      const fullName = path.join(SERVER_DIR, normalized);
      const pathTraversal = !fullName.startsWith(SERVER_DIR);

      if (pathTraversal) {
        return null;
      }

      return { file, resolved: fullName };
    })
    .filter((x) => x !== null);

  if (fileNames.length === 0) {
    throw new Error('FILE DOES NOT EXIST');
  }

  return fileNames as { file: string; resolved: string }[];
};
