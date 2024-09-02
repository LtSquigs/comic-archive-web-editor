import express from 'express';
import { Archive } from './archive.js';
import fs from 'fs';
import {
  getArchivesRelative,
  resolveFiles,
  SERVER_DIR,
  SERVER_HOST,
  SERVER_PORT,
} from './lib.js';
import {
  APIMetadata,
  ConflictedMetadataEntry,
  EntryMap,
  JoinPair,
  Metadata,
  MetadataMap,
  Split,
} from './shared/types.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const getFiles = (req: express.Request) => {
  let files = (req.query['files'] || []) as string | string[];

  if (typeof files === 'string') {
    files = [files];
  }

  return resolveFiles(files);
};

const getFileFromBody = (req: express.Request) => {
  let files = (req.body.files as string | string[]) || [];

  if (typeof files === 'string') {
    files = [files];
  }

  return resolveFiles(files);
};

app.get('/archive/list', async (req, res) => {
  const prefix = (req.query['prefix'] || '') as string;
  const files = await getArchivesRelative(prefix);
  res.json({ paths: files });
});

app.post('/archive/image/join', async (req, res) => {
  const files = getFiles(req);
  const pairs: JoinPair[] = req.body || [];

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }
  const archive = new Archive(files[0].resolved);
  await archive.load();

  try {
    await archive.combineImages(pairs);
  } finally {
    archive.close();
  }
  res.json({ success: true });
});

app.get('/archive/image', async (req, res) => {
  const files = getFiles(req);

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const entry = req.query['entry'] as string;

  const archive = new Archive(files[0].resolved);
  await archive.load();

  try {
    let [img, mime] = await archive.getImageByName(entry);

    if (img === null) {
      res.end();
      return;
    }
    res.set('Content-Type', mime || undefined);
    res.send(img);
  } finally {
    archive.close();
  }
});

app.get('/archive/cover', async (req, res) => {
  const files = getFiles(req);

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const archive = new Archive(files[0].resolved);
  await archive.load();

  try {
    let [img, mime] = await archive.getCover();

    if (img === null) {
      res.end();
      return;
    }
    res.set('Content-Type', mime || undefined);
    res.send(img);
  } finally {
    archive.close();
  }
});

app.post('/archive/cover', async (req, res) => {
  const files = getFiles(req);
  const newCover: string = (req.body || {}).entry;

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  if (!newCover) {
    throw new Error('No Cover Selected');
  }

  const archive = new Archive(files[0].resolved);
  await archive.load();
  try {
    await archive.setCover(newCover);
  } finally {
    await archive.close();
  }

  res.json({ success: true });
});

app.get('/archive/entries', async (req, res) => {
  const files = getFiles(req);

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const archive = new Archive(files[0].resolved);
  await archive.load();
  try {
    res.json({ entries: await archive.entries() });
  } finally {
    archive.close();
  }
});

app.post('/archive/entries', async (req, res) => {
  const files = getFiles(req);
  const nameMap: EntryMap = req.body || {};

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const archive = new Archive(files[0].resolved);
  await archive.load();
  try {
    await archive.renameEntries(nameMap);
  } finally {
    await archive.close();
  }

  res.json({ success: true });
});

app.post('/archive/split', async (req, res) => {
  const files = getFiles(req);
  const splits: Split[] = req.body || [];

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  if (splits.length <= 0) {
    return res.json({ success: true });
  }

  const archive = new Archive(files[0].resolved);
  await archive.load();
  try {
    await archive.split(splits);
  } finally {
    await archive.close();
  }

  res.json({ success: true });
});

app.post('/archive/flatten', async (req, res) => {
  for (const { resolved } of getFiles(req)) {
    const archive = new Archive(resolved);
    await archive.load();
    try {
      await archive.flatten();
    } finally {
      await archive.close();
    }
  }

  res.json({ success: true });
});

app.post('/archive/removeExif', async (req, res) => {
  for (const { resolved } of getFiles(req)) {
    const archive = new Archive(resolved);
    await archive.load();
    try {
      await archive.removeExif();
    } finally {
      await archive.close();
    }
  }

  res.json({ success: true });
});

app.post('/archive/delete', async (req, res) => {
  for (const { resolved } of getFiles(req)) {
    fs.unlinkSync(resolved);
  }

  res.json({ success: true });
});

app.get('/archive/metadata', async (req, res) => {
  const files = getFiles(req);
  let terminated = false;

  req.on('close', () => {
    terminated = true;
  });

  let idx = 0;
  let allMetadata: APIMetadata | undefined = undefined;

  // This loop is done with setImmediate because with a large enough
  // fileset of large files, it will DOS the server otherwise.
  const loop = async () => {
    if (terminated) {
      res.end();
      return;
    }
    if (idx >= files.length) {
      if (files.length > 1 && allMetadata !== undefined) {
        delete allMetadata['pages'];
      }

      res.json({ metadata: allMetadata });
      return;
    }
    const file = files[idx];
    const archive = new Archive(file.resolved);
    await archive.load();
    try {
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
    } finally {
      archive.close();
    }

    idx = idx + 1;
    setImmediate(loop);
  };

  loop();
});

app.post('/archive/metadata', async (req, res) => {
  const newMetadata: Metadata = req.body || {};

  for (const file of getFiles(req)) {
    const archive = new Archive(file.resolved);
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
  res.json({ success: true });
});

app.post('/archive/metadata/bulk', async (req, res) => {
  const metadata: MetadataMap = req.body.metadata || {};

  for (const { file, resolved } of getFileFromBody(req)) {
    const archive = new Archive(resolved);
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
  res.json({ success: true });
});

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (res.headersSent) {
      return next(err);
    }
    console.log(err);
    res.status(500).json({ error: err.message });
  }
);

app.listen(SERVER_PORT, SERVER_HOST, () => {
  console.log(`[ ready ] http://${SERVER_HOST}:${SERVER_PORT}`);
  console.log(`Serving Manga From ${SERVER_DIR}`);
});
