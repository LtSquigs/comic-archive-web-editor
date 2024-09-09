# Comic Archive Web Editor

A web based editor for comic book archives (\*.cbz format files). This is both a server and client, and is intended to be run on things like a NAS or other servers where you archive CBZ files.

This editor saves/edits CBZ files in place. It is recommended to backup your files before editing.

The editor currently supports:

- Editing the metadata (ComicBook.xml) of an archive, including individual page metadata
- Generating a cover file for an archive
- Flattening/Renaming the entries of archives in bulk to standardized names.
- Removing EXIF data from images.
- Joining images within an archive together (e.g. double page spreads)
- Spltting an Archive into multiple smaller archives (e.g. spltting a Volume into multiple Chapters)
- Editing the metadata of multiple archives in bulk using CSV
- Scraping metadata from ComicVine and MyAnimeList APIs

### Running the server

This server is intended to be run on something like a NAS along with the CBZ files you are archiving, but it can also be run locally.

The easiest way to run the server is to just build the Docker image via the main docker file, and then run the resulting image mounting the file containing your archives into the `/archives` folder, e.g.

This image is built automatically on every push to this repo and can be found [here](https://github.com/LtSquigs/comic-archive-web-editor/pkgs/container/ltsquigs%2Fcomic-archive-web-editor).

It can also be built manually via the commands:

```
docker build -t <image_tag> .
docker run -it <image_tag> -v <archive_dir>:/archives -p <port>:3000
```

If you want to run the server/client outside of docker first you must build the frontend project, create a symbolic link in the backend project to it, and then build and run the backend project.

```
cd frontend
npm i
npx vita build
cd ../backend
ln -s ../frontend/dist public
npx tsc
ARCHIVE_DIR=<archive_dir> node dist/main.js
```

### Setting up ComicVine or MyAnimeList scraper

In order to scrape from ComicVine or MyAnimeList you will need an API Key/Client Key for them.

For ComicVine, you can get this by signing up for ComicVine and going to [https://comicvine.gamespot.com/api/](https://comicvine.gamespot.com/api/) to get your key.

For MyAnimeList, you must go to your user settings and request setting up an App. This app should be set as an "other" app and you should fill out what is required in the form. This should provide you with a Client Key and Secret. You _only_ need the Client Key in order to use it with this tool.

These can be saved in the scraper dialogue box.

### Example Screenshots

| Editing Metadata                                          | Page Metadata                                            | Editing Entries                                        |
| --------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| ![Editing Metadata](docs/metadata.png 'Editing Metadata') | ![Page Metadata](docs/page-metadata.png 'Page Metadata') | ![Editing Entries](docs/entries.png 'Editing Entries') |

| Joining Images                                          | Splitting Archive                                                 | Bulk Metadata                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| ![Joining Images](docs/join-image.png 'Joining Images') | ![Splitting Archive](docs/split-archives.png 'Splitting Archive') | ![Bulk Metadata](docs/entries.png 'Bulk Metadata') |
