import { Archive } from './archive.js';
import fs from 'fs';
import http from 'http';
import {
  getArchivesRelative,
  getStaticFile,
  resolveFiles,
  SERVER_HOST,
  SERVER_PORT,
} from './lib.js';
import {
  APIMetadata,
  EntryMap,
  JoinPair,
  Metadata,
  MetadataMap,
  Split,
} from './shared/types.js';
import { URLSearchParams } from 'url';
import { Readable } from 'stream';
import { RouteHandlers } from './types.js';

const getFiles = (req: URLSearchParams) => {
  return resolveFiles(req.getAll('files'));
};

const getFileFromBody = (body: any) => {
  return resolveFiles(body.files || []);
};

const routes: { [key: string]: RouteHandlers } = {
  '/archive/list': async (params) => {
    const prefix = (params.get('prefix') || '') as string;
    const files = await getArchivesRelative(prefix);
    return { type: 'json', body: { paths: files } };
  },
  '/archive/image/join': {
    POST: async (params, body, signal) => {
      const files = getFiles(params);
      const pairs: JoinPair[] = body || [];

      if (files.length > 1) {
        throw new Error('TOO MANY FILES');
      }
      const archive = new Archive(files[0].resolved, signal);
      await archive.load();

      try {
        await archive.combineImages(pairs);
      } finally {
        await archive.close();
      }
      return { type: 'json', body: { success: true } };
    },
  },
  '/archive/image': async (params, body, signal) => {
    const files = getFiles(params);

    if (files.length > 1) {
      throw new Error('TOO MANY FILES');
    }

    const entry = params.get('entry') || '';

    const archive = new Archive(files[0].resolved, signal);
    await archive.load();

    try {
      let [img, mime] = await archive.getImageByName(entry);

      if (img === null) {
        return null;
      }

      return { type: 'stream', mime: mime || '', body: img };
    } finally {
      await archive.close();
    }
  },
  '/archive/cover': {
    GET: async (params, body, signal) => {
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
    },
    POST: async (params, body, signal) => {
      const files = getFiles(params);
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
    },
  },
  '/archive/entries': {
    GET: async (params, body, signal) => {
      const files = getFiles(params);

      if (files.length > 1) {
        throw new Error('TOO MANY FILES');
      }

      const archive = new Archive(files[0].resolved, signal);
      await archive.load();
      try {
        return { type: 'json', body: { entries: await archive.entries() } };
      } finally {
        await archive.close();
      }
    },
    POST: async (params, body, signal) => {
      const files = getFiles(params);
      const nameMap: EntryMap = body || {};

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
    },
  },
  '/archive/split': {
    POST: async (params, body, signal) => {
      const files = getFiles(params);
      const splits: Split[] = body || [];

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
    },
  },
  '/archive/flatten': {
    POST: async (params, body, signal) => {
      for (const { resolved } of getFiles(params)) {
        const archive = new Archive(resolved, signal);
        await archive.load();
        try {
          await archive.flatten();
        } finally {
          await archive.close();
        }
      }

      return { type: 'json', body: { success: true } };
    },
  },
  '/archive/removeExif': {
    POST: async (params, body, signal) => {
      for (const { resolved } of getFiles(params)) {
        const archive = new Archive(resolved, signal);
        await archive.load();
        try {
          await archive.removeExif();
        } finally {
          await archive.close();
        }
      }

      return { type: 'json', body: { success: true } };
    },
  },
  '/archive/delete': {
    POST: async (params, body, signal) => {
      for (const { resolved } of getFiles(params)) {
        fs.unlinkSync(resolved);
      }

      return { type: 'json', body: { success: true } };
    },
  },
  '/archive/metadata': {
    GET: async (params, body, signal) => {
      return new Promise((resolve, reject) => {
        const files = getFiles(params);
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
                    values: [
                      allMetadata[typedProp],
                      metadata[typedProp],
                    ].filter((val) => val !== null && val !== undefined),
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
    },
    POST: async (params, body, signal) => {
      const newMetadata: Metadata = body || {};

      for (const file of getFiles(params)) {
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
    },
  },
  '/archive/metadata/bulk': {
    POST: async (params, body, signal) => {
      const metadata: MetadataMap = (body || {}).metadata || {};

      for (const { file, resolved } of getFileFromBody(body)) {
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
    },
  },
};

const serverFunc = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  signal: AbortSignal
) => {
  if (!req.url || !req.method) {
    if (!res.writableEnded) {
      res.writeHead(500);
      res.end();
    }
    return;
  }
  const url = new URL(req.url, `http://${SERVER_HOST}:${SERVER_PORT}`);
  const path = url.pathname;
  const method = req.method;

  console.log(`${method} request: ${req.url}`);

  if (
    path[path.length - 1] === '/' &&
    path.slice(0, path.length - 1) in routes
  ) {
    // send 301 redirect to non /
    if (!res.writableEnded) {
      res.writeHead(301, {
        Location: path.slice(0, path.length - 1),
      });
      res.end();
    }

    return;
  }

  if (path in routes) {
    const handlers = routes[path];
    let response = null;
    let body = {};

    if (
      req.headers &&
      req.headers['content-type'] === 'application/json' &&
      method === 'POST'
    ) {
      const readBodyPromise = new Promise<any>((resolve, reject) => {
        let body = '';
        req.on('readable', function () {
          const data = req.read();
          body += data ?? '';
        });
        req.on('end', function () {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', (err) => {
          reject(err);
        });
      });

      body = await readBodyPromise;
    }
    if (typeof handlers === 'function' && method === 'GET') {
      response = await handlers(url.searchParams, body, signal);
    } else if (typeof handlers === 'object' && method in handlers) {
      response = await (handlers as any)[method](
        url.searchParams,
        body,
        signal
      );
    }

    if (response && response.type === 'json') {
      if (!res.writableEnded) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response.body));
      }
      return;
    } else if (response && response.type === 'stream') {
      if (!res.writableEnded) {
        res.writeHead(200, { 'Content-Type': response.mime });
        response.body.pipe(res);
      }
      return;
    }

    if (!res.writableEnded) {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  const staticFile = await getStaticFile(path);
  if (!staticFile.found) {
    res.writeHead(404);
    res.end();
    return;
  }

  res.writeHead(200, { 'Content-Type': staticFile.mimeType });
  staticFile.stream.pipe(res);
};

const server = http.createServer(async (req, res) => {
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
    await serverFunc(req, res, abortController.signal);
  } catch (error) {
    console.log(`${req.method} request error: ${req.url}`);
    if (error && typeof error === 'object' && 'message' in error)
      console.log(`\t${error.message}`);
    else console.log(`\t${error}`);
    abortController.abort();
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: true,
          errorStr:
            error && typeof error === 'object' && 'message' in error
              ? error.message
              : `${error}`,
        })
      );
    }
  } finally {
    req.socket.off('close', abortListener);
  }
});

server.listen(SERVER_PORT, SERVER_HOST);
console.log(`Server Running on ${SERVER_HOST}:${SERVER_PORT}`);
