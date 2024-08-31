import express from 'express';
import { posix as path } from 'path';
import { glob } from 'glob';
import { CBZ } from './cbz.js';
import fs from 'fs';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const dir = path.resolve(process.env.MANGA_DIR ?? '/manga');

const app = express();
app.use(express.json());
app.use(express.static('public'));

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const getArchives = async () => {
  const paths = await glob(path.join(dir, '**/*.cbz'));
  const replacer = new RegExp(`^${escapeRegExp(dir + path.sep) + '?'}`, '');
  const stripped = paths.map((rawPath) => rawPath.replace(replacer, ''));
  return stripped;
};

const getFiles = (req: express.Request) => {
  let files = (req.query['files'] || []) as string | string[];

  if (typeof files === 'string') {
    files = [files];
  }

  const fileNames = files.map((file) => {
    // Normalizes away path traversal
    const normalized = path.join('/', file);
    const fullName = path.join(dir, normalized);

    return fullName;
  });

  if (fileNames.length === 0) {
    throw new Error('FILE DOES NOT EXIST');
  }

  return fileNames;
};

const getFileFromBody = (req: express.Request) => {
  let files = (req.body.files || []) as string | string[];

  if (typeof files === 'string') {
    files = [files];
  }

  const fileNames = files.map((file) => {
    // Normalizes away path traversal
    const normalized = path.join('/', file);
    const fullName = path.join(dir, normalized);

    return [file, fullName];
  });

  if (fileNames.length === 0) {
    throw new Error('FILE DOES NOT EXIST');
  }

  return fileNames;
};

app.get('/cbz/list', async (req, res) => {
  const files = await getArchives();
  const tree = {};
  for (let file of files.sort()) {
    const parts = file.split(path.sep);
    let level: any = tree;
    for (let part of parts) {
      level[part] = level[part] || {};
      level = level[part];
    }

    level.name = file;
  }

  res.json({ paths: tree });
});

app.post('/cbz/image/join', async (req, res) => {
  const files = getFiles(req);
  const pairs = req.body || [];

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }
  const cbz = new CBZ(files[0]);
  await cbz.load();

  try {
    await cbz.combineImages(pairs);
  } finally {
    cbz.close();
  }
  res.json({ success: true });
});

app.get('/cbz/image', async (req, res) => {
  const files = getFiles(req);

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const entry = req.query['entry'] as string;

  const cbz = new CBZ(files[0]);
  await cbz.load();

  try {
    let [img, mime] = await cbz.getImageByName(entry);

    if (img === null) {
      res.end();
      return;
    }
    res.set('Content-Type', mime);
    res.send(img);
  } finally {
    cbz.close();
  }
});

app.get('/cbz/cover', async (req, res) => {
  const files = getFiles(req);

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const cbz = new CBZ(files[0]);
  await cbz.load();

  try {
    let [img, mime] = await cbz.getCover();

    if (img === null) {
      res.end();
      return;
    }
    res.set('Content-Type', mime);
    res.send(img);
  } finally {
    cbz.close();
  }
});

app.post('/cbz/cover', async (req, res) => {
  const files = getFiles(req);
  const newCover = (req.body || {}).entry;

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  if (!newCover) {
    throw new Error('No Cover Selected');
  }

  const cbz = new CBZ(files[0]);
  await cbz.load();
  try {
    await cbz.setCover(newCover);
  } finally {
    await cbz.close();
  }

  res.json({ success: true });
});

app.get('/cbz/entries', async (req, res) => {
  const files = getFiles(req);

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const cbz = new CBZ(files[0]);
  await cbz.load();
  try {
    res.json({ entries: await cbz.entries() });
  } finally {
    cbz.close();
  }
});

app.post('/cbz/entries', async (req, res) => {
  const files = getFiles(req);
  const nameMap = req.body || {};

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const cbz = new CBZ(files[0]);
  await cbz.load();
  try {
    await cbz.renameEntries(nameMap);
  } finally {
    await cbz.close();
  }

  res.json({ success: true });
});

app.post('/cbz/split', async (req, res) => {
  const files = getFiles(req);
  const splits = req.body || [];

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  if (splits.length <= 0) {
    return res.json({ success: true });
  }

  const cbz = new CBZ(files[0]);
  await cbz.load();
  try {
    await cbz.split(dir, splits);
  } finally {
    await cbz.close();
  }

  res.json({ success: true });
});

app.post('/cbz/flatten', async (req, res) => {
  for (let file of getFiles(req)) {
    const cbz = new CBZ(file);
    await cbz.load();
    try {
      await cbz.flatten();
    } finally {
      await cbz.close();
    }
  }

  res.json({ success: true });
});

app.post('/cbz/removeExif', async (req, res) => {
  for (let file of getFiles(req)) {
    const cbz = new CBZ(file);
    await cbz.load();
    try {
      await cbz.removeExif();
    } finally {
      await cbz.close();
    }
  }

  res.json({ success: true });
});

app.post('/cbz/delete', async (req, res) => {
  for (let file of getFiles(req)) {
    fs.unlinkSync(file);
  }

  res.json({ success: true });
});

app.get('/cbz/metadata', async (req, res) => {
  const files = getFiles(req);
  let terminated = false;

  req.on('close', () => {
    terminated = true;
  });

  let idx = 0;
  let allMetadata: any = undefined;
  const loop = async () => {
    if (terminated) {
      res.end();
      return;
    }
    if (idx >= files.length) {
      if (files.length > 1) {
        delete allMetadata['pages'];
      }

      res.json({ metadata: allMetadata });
      return;
    }
    const file = files[idx];
    const cbz = new CBZ(file);
    await cbz.load();
    try {
      const metadata = (await cbz.getMetadata()).copyOut();
      if (allMetadata === undefined) {
        allMetadata = metadata;
      } else {
        for (const prop in metadata) {
          if (metadata[prop] !== allMetadata[prop] && prop !== 'pages') {
            if (allMetadata.conflict) {
              if (metadata[prop] !== null && metadata !== undefined) {
                allMetadata.values.push(metadata[prop]);
              }
              continue;
            }
            allMetadata[prop] = {
              conflict: true,
              values: [allMetadata[prop], metadata[prop]].filter(
                (val) => val !== null && val !== undefined
              ),
            };
          } else {
            allMetadata[prop] = metadata[prop];
          }
        }
      }
    } finally {
      cbz.close();
    }

    idx = idx + 1;
    setImmediate(loop);
  };

  loop();
});

app.post('/cbz/metadata', async (req, res) => {
  const newMetadata = req.body || {};

  for (let file of getFiles(req)) {
    const cbz = new CBZ(file);
    await cbz.load();
    try {
      const oldMetadata = (await cbz.getMetadata()).copyOut();

      for (let prop in newMetadata) {
        if (newMetadata[prop] === undefined) {
          delete newMetadata[prop];
        }
      }

      await cbz.setMetadata({ ...oldMetadata, ...newMetadata });
    } finally {
      await cbz.close();
    }
  }
  res.json({ success: true });
});

app.post('/cbz/metadata/bulk', async (req, res) => {
  const metadata = req.body.metadata || {};

  for (let [file, fullName] of getFileFromBody(req)) {
    const cbz = new CBZ(fullName);
    await cbz.load();
    try {
      const oldMetadata = (await cbz.getMetadata()).copyOut();
      const newMetadata = metadata[file];

      for (let prop in newMetadata) {
        if (newMetadata[prop] === undefined) {
          delete newMetadata[prop];
        }
      }

      await cbz.setMetadata({ ...oldMetadata, ...newMetadata });
    } finally {
      await cbz.close();
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

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
  console.log(`Serving Manga From ${dir}`);
});
