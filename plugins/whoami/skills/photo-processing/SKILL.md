---
name: photo-processing
description: Processing photos for wiki pages
triggers: ["photo", "image", "picture", "album", "trip"]
---

# Photo Processing for Wiki Pages

## Reading EXIF
Use exiftool to extract metadata:
exiftool -json -DateTimeOriginal -GPSLatitude -GPSLongitude *.jpg

## Contact Sheets
For overview of many photos:
montage -geometry 200x200+2+2 -tile 10x *.jpg contact.jpg

## Key Photo Selection
When selecting photos for a page:
- One establishing shot per location
- Action shots over posed photos  
- Include timestamps in captions when relevant

## Uploading to Wiki
Use `wai upload <file>` to upload images to the wiki.
Uploaded files can be referenced in pages with `[[File:filename.jpg]]`.

## Handling Missing Metadata
If no EXIF GPS data, look for:
- Filenames with location hints
- Surrounding photos with data
- Visual landmarks to identify location
- `wai place <query>` to look up a place by name
