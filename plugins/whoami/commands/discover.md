# Discover Pages

Scan sources for potential pages that don't exist yet.

## Process
1. Run `wai source list` to get configured source directories
2. Use `wai snapshot <dir>` on each source to inventory files
3. For photos: identify temporal/geographic clusters using exiftool
4. Run `wai search "<topic>"` for each cluster to check if a page exists
5. Run `wai category` to see what's already covered
6. Create stubs with `wai create "<title>" -c "{{stub}}"` for uncovered topics
7. Report what was found and what stubs were created
