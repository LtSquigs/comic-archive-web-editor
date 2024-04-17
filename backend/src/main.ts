import express from 'express';
import path from 'path';
import { glob } from 'glob';
import { CBZ } from './cbz';

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

app.get('/cbz/entries', async (req, res) => {
  const files = getFiles(req);

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const cbz = new CBZ(files[0]);
  res.json({ entries: cbz.entries() });
});

app.post('/cbz/entries', async (req, res) => {
  const files = getFiles(req);
  const nameMap = req.body || {};

  if (files.length > 1) {
    throw new Error('TOO MANY FILES');
  }

  const cbz = new CBZ(files[0]);
  cbz.renameEntries(nameMap);
  cbz.save();

  res.json({ success: true });
});

app.post('/cbz/flatten', async (req, res) => {
  for (let file of getFiles(req)) {
    const cbz = new CBZ(file);
    cbz.flatten();
    cbz.save();
  }

  res.json({ success: true });
});

app.get('/cbz/metadata', async (req, res) => {
  const files = getFiles(req);

  const combinedInfo = files
    .map((file) => {
      const cbz = new CBZ(file);
      return cbz.getMetadata();
    })
    .reduce((lastValue: any, currentValue: any): any => {
      if (lastValue === undefined) {
        const curValue = currentValue.copyOut();
        return curValue;
      }

      const currentObj = currentValue.copyOut();
      for (const prop in currentObj) {
        if (lastValue[prop] === null || lastValue[prop] === undefined) {
          lastValue[prop] = currentObj[prop];
          continue;
        }

        if (currentObj[prop] !== lastValue[prop] && prop !== 'pages') {
          if (lastValue.conflict) {
            if (currentObj[prop] !== null && currentObj !== undefined) {
              lastValue.values.push(currentObj[prop]);
            }

            continue;
          }

          lastValue[prop] = {
            conflict: true,
            values: [lastValue[prop], currentValue[prop]].filter(
              (val) => val !== null && val !== undefined
            ),
          };
        }
      }

      return lastValue;
    }, undefined);

  if (files.length > 1) {
    delete combinedInfo['pages'];
  }

  res.json({ metadata: combinedInfo });
});

app.post('/cbz/metadata', async (req, res) => {
  const newMetadata = req.body || {};

  for (let file of getFiles(req)) {
    const cbz = new CBZ(file);
    const oldMetadata = cbz.getMetadata().copyOut();

    for (let prop in newMetadata) {
      if (newMetadata[prop] === undefined) {
        delete newMetadata[prop];
      }
    }

    cbz.setMetadata({ ...oldMetadata, ...newMetadata });
    cbz.save();
  }
  res.json({ success: true });
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: err });
  }
);

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
  console.log(`Serving Manga From ${dir}`);
});
