A web based server/editor that can be used to edit Comic Archives (e.g. \*.cbz files) in various ways.

The server currently supports:

- Editing the metadata (ComicBook.xml) of an archive, including individual page metadata
- Generating a cover file for an archive
- Flattening/Renaming the entries of archives in bulk to standardized names.
- Joining images within an archive together (e.g. double page spreads)
- Spltting an Archive into multiple smaller archives (e.g. spltting a Volume into multiple Chapters)
- Editing the metadata of multiple archives in bulk using CSV

# Running the server

This server is intended to be run on something like a NAS along with the CBZ files you are archiving, but it can also be run locally.

The easiest way to run the server is to just build the Docker image via the main docker file, and then run the resulting image mounting the file containing your archives into the `/archives` folder, e.g.

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
