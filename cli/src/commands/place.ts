import { parseArgs } from "node:util";
import { WikiClient } from "../wiki-client.js";
import { loadConfig } from "../auth.js";
import { UsageError, WaiError } from "../errors.js";
import { type GlobalFlags, outputJson } from "../output.js";

export async function placeCommand(
  args: string[],
  globals: GlobalFlags,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      limit: { type: "string", short: "n" },
    },
    allowPositionals: true,
    strict: false,
  });

  const query = positionals.join(" ");
  if (!query) throw new UsageError("Usage: wai place <query> [--limit N]");

  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY || loadConfig().googlePlacesApiKey;
  if (!apiKey) {
    throw new WaiError(
      "No Google Places API key. Set GOOGLE_PLACES_API_KEY or add googlePlacesApiKey to ~/.whoami/config.json.",
      1,
    );
  }

  const limit = values.limit ? parseInt(values.limit as string, 10) : 5;
  const client = new WikiClient(""); // Just using the static method
  const results = await client.lookupPlace(query, apiKey, limit);

  if (globals.json) {
    outputJson(results);
  } else {
    console.log(
      `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`,
    );
    console.log();
    for (const p of results) {
      console.log(`  ${p.name}`);
      console.log(`    ${p.address}`);
      if (p.rating) {
        console.log(
          `    ${p.rating}★${p.userRatingCount ? ` (${p.userRatingCount} reviews)` : ""}`,
        );
      }
      if (p.open !== undefined) {
        console.log(`    ${p.open ? "Open now" : "Closed"}`);
      }
      console.log();
    }
  }
}
