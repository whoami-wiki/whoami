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

## Supported Formats
JPEG, PNG, HEIC, WebP, TIFF

## Uploading to Wiki
Use `wai upload <file>` to upload images to the wiki.
Uploaded files can be referenced in pages with `[[File:filename.jpg]]`.

## Citing Photos
Use `{{Cite photo}}` for inline citations when a fact is derived from a photo:

```wikitext
<ref name="img-2021-05-20">
{{Cite photo|file=IMG_2847.jpg|hash=...|date=2021-05-20
|snapshot=a1b2c3d4e5f6|note=University ID confirming enrollment}}</ref>
```

## Cross-referencing with Other Sources
Photos are most valuable when combined with other data:
- Match photo timestamps against location history for precise GPS coordinates
- Cross-reference photo dates with bank transactions to identify venues
- Use message context from the same time period to identify people and events
- Cross-referenced facts should cite multiple sources

## Handling Missing Metadata
If no EXIF GPS data, look for:
- Filenames with location hints
- Surrounding photos with data
- Visual landmarks to identify location
- `wai place <query>` to look up a place by name
