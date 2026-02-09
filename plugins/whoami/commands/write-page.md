# Write Page

Write a wiki page about: $ARGUMENTS

## Process
1. Run `wai search "$ARGUMENTS"` to check if a page or stub already exists
2. Run `wai source list` and explore relevant sources based on the topic
3. Browse source files to gather material (photos, archives, location data)
4. Draft the page with proper wikitext formatting
5. Create the page with `wai create "<title>" -f draft.wiki -m "initial draft"`
6. Post questions to the talk page with `wai talk create "<title>" -s "Gaps" -c "..."`
7. Summarize what was written and what gaps remain
