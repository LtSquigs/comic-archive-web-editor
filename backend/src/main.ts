import { Archive, Merger } from './archive.js';
import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import {
  getArchivesRelative,
  getKeys,
  hexToRgb,
  resolveFiles,
  saveKeys,
  scrapeUrl,
  SERVER_DIR,
  SERVER_HOST,
  SERVER_PORT,
  STATIC_PATH,
} from './lib.js';
import {
  APIMetadata,
  EntryMap,
  JoinPair,
  Metadata,
  MetadataMap,
  Split,
} from './shared/types.js';
import { RouteHandler } from './types.js';
import sharp from 'sharp';
import mime from 'mime';
import cors from 'cors';

const getFiles = (params: any) => {
  let files = (params['files'] || []) as string | string[];

  if (typeof files === 'string') {
    files = [files];
  }

  return resolveFiles(files);
};

const getFilesFromBody = (body: any) => {
  let files = (body.files as string | string[]) || [];

  if (typeof files === 'string') {
    files = [files];
  }

  return resolveFiles(files);
};

const app = express();
app.use(express.json());
app.use(fileUpload());
app.use(express.static(STATIC_PATH));
app.use(cors());
app.options('*', cors());

const wrapHandler = (fn: RouteHandler): express.RequestHandler => {
  return async (req, res, next) => {
    console.log(`${req.method} request: ${req.url}`);
    const abortController = new AbortController();
    const abortListener = () => {
      let probablyAborted = !res.writableEnded;

      if (probablyAborted) {
        if (!res.writableEnded) res.end();
        console.log(`${req.method} request aborted: ${req.url}`);
        abortController.abort();
      }

      req.socket.off('close', abortListener);
    };
    req.socket.on('close', abortListener);

    try {
      const response = await fn(
        req.query,
        req.body,
        abortController.signal,
        req.files
      );

      if (abortController.signal.aborted) {
        return;
      }

      if (response === null) {
        res.status(500).end();
        return;
      }

      if (response.type === 'json') {
        res.status(200).json(response.body);
        return;
      }

      res.status(200);
      res.set('Content-Type', response.mime);
      response.body.pipe(res);
    } finally {
      req.socket.off('close', abortListener);
    }
  };
};

app.get(
  '/archive/list',
  wrapHandler(async (params, body, signal) => {
    const prefix = (params['prefix'] || '') as string;
    const files = await getArchivesRelative(prefix);
    return { type: 'json', body: { paths: files } };
  })
);

app.put(
  '/archive/upload',
  wrapHandler(async (params, body, signal, files) => {
    if (!files) {
      throw new Error('No File sent in request');
    }
    for (const [name, file] of Object.entries(files)) {
      const resolvedName = resolveFiles([name])[0].resolved;
      const fileObj = Array.isArray(file) ? file[0] : file;
      fs.writeFileSync(resolvedName, fileObj.data);
    }
    return { type: 'json', body: { success: true } };
  })
);

app.put(
  '/archive/move',
  wrapHandler(async (params, body, signal) => {
    const fromFile = body.fromFile;
    const toFile = body.toFile;
    if (!fromFile || !toFile) {
      throw new Error('Incorrect parameters');
    }
    const resolvedFrom = resolveFiles([fromFile])[0].resolved;
    const resolvedTo = resolveFiles([toFile])[0].resolved;

    fs.renameSync(resolvedFrom, resolvedTo);

    return { type: 'json', body: { base: path.basename(resolvedTo) } };
  })
);
app.get(
  '/keys',
  wrapHandler(async (params, body, signal) => {
    return { type: 'json', body: { keys: getKeys() } };
  })
);

app.put(
  '/keys',
  wrapHandler(async (params, body, signal) => {
    saveKeys(body.keys);
    return { type: 'json', body: { success: true } };
  })
);

app.post(
  '/scrape',
  wrapHandler(async (params, body, signal) => {
    const url = body.url || '';
    const metadata = await scrapeUrl(url);
    return { type: 'json', body: { metadata } };
  })
);

app.post(
  '/archive/image/join',
  wrapHandler(async (params, body, signal) => {
    const files = getFilesFromBody(body);
    const pairs: JoinPair[] = body.joinList || [];

    if (files.length > 1) {
      throw new Error('TOO MANY FILES');
    }
    const archive = new Archive(files[0].resolved, signal);
    await archive.load();

    try {
      // await archive.combineImages(pairs, body.gap, body.gapColor);
    } finally {
      await archive.close();
    }
    return { type: 'json', body: { success: true } };
  })
);

app.post(
  '/archive/image/upload',
  wrapHandler(async (params, body, signal, files) => {
    const archiveFile = getFilesFromBody(body);
    const entrytoRemove: string = body.entryToRemove;
    if (archiveFile.length > 1) {
      throw new Error('TOO MANY FILES');
    }
    const archive = new Archive(archiveFile[0].resolved, signal);
    await archive.load();
    let imageFiles = (files || {})['images[]'] || [];
    if (!Array.isArray(imageFiles)) {
      imageFiles = [imageFiles];
    }
    try {
      await archive.addEntries(
        imageFiles.map((file) => ({ data: file.data, name: file.name })),
        entrytoRemove
      );
    } finally {
      await archive.close();
    }
    return { type: 'json', body: { success: true } };
  })
);

app.put(
  '/archive/merge',
  wrapHandler(async (params, body, signal) => {
    const merger = new Merger(body, signal);
    await merger.merge();

    return { type: 'json', body: { success: true } };
  })
);

app.get(
  '/archive/download',
  wrapHandler(async (params, body, signal) => {
    const files = getFiles(params);

    if (files.length > 1) {
      throw new Error('TOO MANY FILES');
    }

    const mimeType = mime.getType(files[0].resolved);
    const stream = fs.createReadStream(files[0].resolved);

    return {
      type: 'stream',
      mime: mimeType || '',
      body: stream,
    };
  })
);

app.get(
  '/archive/image',
  wrapHandler(async (params, body, signal) => {
    const files = getFiles(params);

    if (files.length > 1) {
      throw new Error('TOO MANY FILES');
    }

    const entry = params['entry'] || '';

    const archive = new Archive(files[0].resolved, signal);
    await archive.load();

    try {
      let [img, mime] = await archive.getImageByName(entry);

      if (img === null) {
        return null;
      }

      let imgStream = img;

      if (params['ml'] && !isNaN(parseInt(params['ml']))) {
        const gapColor = hexToRgb(params['gapColor'] || '#ffffff');
        const imgPipe = sharp().extend({
          left: parseInt(params['ml']),
          background: {
            r: gapColor?.r,
            g: gapColor?.g,
            b: gapColor?.b,
            alpha: 1,
          },
        });
        imgStream = img.pipe(imgPipe);
      }

      if (params['mr'] && !isNaN(parseInt(params['mr']))) {
        const gapColor = hexToRgb(params['gapColor'] || '#ffffff');
        const imgPipe = sharp().extend({
          right: parseInt(params['mr']),
          background: {
            r: gapColor?.r,
            g: gapColor?.g,
            b: gapColor?.b,
            alpha: 1,
          },
        });
        imgStream = img.pipe(imgPipe);
      }

      return {
        type: 'stream',
        mime: mime || '',
        body: imgStream,
      };
    } finally {
      await archive.close();
    }
  })
);

app.get(
  '/archive/cover',
  wrapHandler(async (params, body, signal) => {
    const files = getFiles(params);

    if (files.length > 1) {
      throw new Error('TOO MANY FILES');
    }

    const archive = new Archive(files[0].resolved, signal);
    await archive.load();

    try {
      let [img, mime] = await archive.getCover();

      if (img === null) {
        return null;
      }
      return { type: 'stream', mime: mime || '', body: img };
    } finally {
      await archive.close();
    }
  })
);

app.post(
  '/archive/cover',
  wrapHandler(async (params, body, signal) => {
    const files = getFilesFromBody(body);
    const newCover: string = (body || {}).entry;

    if (files.length > 1) {
      throw new Error('TOO MANY FILES');
    }

    if (!newCover) {
      throw new Error('No Cover Selected');
    }

    const archive = new Archive(files[0].resolved, signal);
    await archive.load();
    try {
      await archive.setCover(newCover);
    } finally {
      await archive.close();
    }

    return { type: 'json', body: { success: true } };
  })
);

app.post(
  '/archive/entries',
  wrapHandler(async (params, body, signal) => {
    const files = getFilesFromBody(body);

    if (files.length > 1) {
      throw new Error('TOO MANY FILES');
    }

    const getDimensions = params['dimensions'] === '1';

    const archive = new Archive(files[0].resolved, signal);
    await archive.load();
    try {
      return {
        type: 'json',
        body: { entries: await archive.entries(getDimensions) },
      };
    } finally {
      await archive.close();
    }
  })
);

app.put(
  '/archive/entries',
  wrapHandler(async (params, body, signal) => {
    const files = getFilesFromBody(body);
    const nameMap: EntryMap = body.map || {};

    if (files.length > 1) {
      throw new Error('TOO MANY FILES');
    }

    const archive = new Archive(files[0].resolved, signal);
    await archive.load();
    try {
      await archive.renameEntries(nameMap);
    } finally {
      await archive.close();
    }

    return { type: 'json', body: { success: true } };
  })
);

app.post(
  '/archive/split',
  wrapHandler(async (params, body, signal) => {
    const files = getFilesFromBody(body);
    const splits: Split[] = body.splits || [];

    if (files.length > 1) {
      throw new Error('TOO MANY FILES');
    }

    if (splits.length <= 0) {
      return { type: 'json', body: { success: true } };
    }

    const archive = new Archive(files[0].resolved, signal);
    await archive.load();
    try {
      await archive.split(splits);
    } finally {
      await archive.close();
    }

    return { type: 'json', body: { success: true } };
  })
);

app.post(
  '/archive/flatten',
  wrapHandler(async (params, body, signal) => {
    for (const { resolved } of getFilesFromBody(body)) {
      const archive = new Archive(resolved, signal);
      await archive.load();
      try {
        await archive.flatten();
      } finally {
        await archive.close();
      }
    }

    return { type: 'json', body: { success: true } };
  })
);

app.post(
  '/archive/removeExif',
  wrapHandler(async (params, body, signal) => {
    for (const { resolved } of getFilesFromBody(body)) {
      const archive = new Archive(resolved, signal);
      await archive.load();
      try {
        await archive.removeExif();
      } finally {
        await archive.close();
      }
    }

    return { type: 'json', body: { success: true } };
  })
);

app.post(
  '/archive/delete',
  wrapHandler(async (params, body, signal) => {
    for (const { resolved } of getFilesFromBody(body)) {
      fs.unlinkSync(resolved);
    }

    return { type: 'json', body: { success: true } };
  })
);

app.post(
  '/archive/metadata',
  wrapHandler(async (params, body, signal) => {
    return new Promise((resolve, reject) => {
      const files = getFilesFromBody(body);
      let idx = 0;
      let allMetadata: APIMetadata | undefined = undefined;

      // This loop is done with setImmediate because with a large enough
      // fileset of large files, it will DOS the server otherwise.
      const loop = async () => {
        if (idx >= files.length) {
          if (files.length > 1 && allMetadata !== undefined) {
            delete allMetadata['pages'];
          }

          resolve({ type: 'json', body: { metadata: allMetadata } });
          return;
        }
        const file = files[idx];
        const archive = new Archive(file.resolved);
        try {
          await archive.load();
          const metadata: Metadata = (await archive.getMetadata()).copyOut();
          if (allMetadata === undefined) {
            allMetadata = metadata;
          } else {
            for (const prop in metadata) {
              let typedProp = prop as keyof Metadata;
              const allValue = allMetadata[typedProp];
              const metaValue = metadata[typedProp];
              if (metaValue !== allValue && prop !== 'pages') {
                if (
                  allValue !== null &&
                  typeof allValue === 'object' &&
                  'conflict' in allValue
                ) {
                  if (metaValue !== null && metadata !== undefined) {
                    (allValue.values as any[]).push(metaValue);
                  }
                  continue;
                }
                (allMetadata as any)[typedProp] = {
                  conflict: true,
                  values: [allMetadata[typedProp], metadata[typedProp]].filter(
                    (val) => val !== null && val !== undefined
                  ),
                };
              } else {
                (allMetadata as any)[typedProp] = metadata[typedProp];
              }
            }
          }
        } catch (e: any) {
          reject(e);
        } finally {
          await archive.close();
        }

        idx = idx + 1;
        setImmediate(loop);
      };

      loop();
    });
  })
);

app.put(
  '/archive/metadata',
  wrapHandler(async (params, body, signal) => {
    const files = getFilesFromBody(body);
    const newMetadata: Metadata = body.metadata || {};

    for (const file of files) {
      const archive = new Archive(file.resolved, signal);
      await archive.load();
      try {
        const oldMetadata = (await archive.getMetadata()).copyOut();

        for (const prop in newMetadata) {
          if (newMetadata[prop as keyof Metadata] === undefined) {
            delete newMetadata[prop as keyof Metadata];
          }
        }

        await archive.setMetadata({ ...oldMetadata, ...newMetadata });
      } finally {
        await archive.close();
      }
    }
    return { type: 'json', body: { success: true } };
  })
);

app.post(
  '/archive/metadata/bulk',
  wrapHandler(async (params, body, signal) => {
    const metadata: MetadataMap = (body || {}).metadata || {};

    for (const { file, resolved } of getFilesFromBody(body)) {
      const archive = new Archive(resolved, signal);
      await archive.load();
      try {
        const oldMetadata = (await archive.getMetadata()).copyOut();
        const newMetadata = metadata[file];

        for (const prop in newMetadata) {
          if (newMetadata[prop as keyof Metadata] === undefined) {
            delete newMetadata[prop as keyof Metadata];
          }
        }

        await archive.setMetadata({ ...oldMetadata, ...newMetadata });
      } finally {
        await archive.close();
      }
    }
    return { type: 'json', body: { success: true } };
  })
);

app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (res.headersSent) {
      return next(error);
    }
    console.log(`${req.method} request error: ${req.url}`);
    if (error && typeof error === 'object' && 'message' in error)
      console.log(`\t${error.message}`);
    else console.log(`\t${error}`);
    res.status(500).json({ error: error.message });
  }
);

app.listen(SERVER_PORT, SERVER_HOST, () => {
  console.log(`[ ready ] http://${SERVER_HOST}:${SERVER_PORT}`);
  console.log(`Serving Manga From ${SERVER_DIR}`);
});
