"""
fetch_inaturalist.py

For each fish in fish_data.json, finds the iNaturalist URL using two methods:
  1. Wikipedia external links API (finds links in the article body)
  2. Wikidata P3151 property (finds the Taxon identifiers section link)

Adds an "inaturalist_url" field to each entry and saves back to fish_data.json.

Usage:
    python3 fetch_inaturalist.py
"""

import json
import time
import urllib.request
import urllib.parse
import urllib.error

INPUT_FILE  = "fish_data.json"
OUTPUT_FILE = "fish_data.json"
BACKUP_FILE = "fish_data.backup.json"
DELAY       = 1.0
MAX_RETRIES = 3
RETRY_WAIT  = 15


def api_get(url):
    """Make a GET request with retries. Returns parsed JSON or None."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "FishWheelBot/1.0 (fish spinning wheel project)"}
    )
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"    [429] Rate limited — waiting {RETRY_WAIT}s (attempt {attempt}/{MAX_RETRIES})...")
                time.sleep(RETRY_WAIT)
            else:
                print(f"    [HTTP {e.code}]")
                return None
        except Exception as e:
            print(f"    [ERROR] {e}")
            return None
    print(f"    [GAVE UP] after {MAX_RETRIES} retries")
    return None


def fetch_from_extlinks(wiki_title):
    """Check Wikipedia article body for an iNaturalist external link."""
    params = urllib.parse.urlencode({
        "action":  "query",
        "titles":  wiki_title,
        "prop":    "extlinks",
        "ellimit": "50",
        "format":  "json",
    })
    data = api_get(f"https://en.wikipedia.org/w/api.php?{params}")
    if not data:
        return None

    for page in data.get("query", {}).get("pages", {}).values():
        for link in page.get("extlinks", []):
            href = link.get("*", "")
            if "inaturalist.org" in href:
                return href
    return None


def fetch_from_wikidata(wiki_title):
    """
    Look up the Wikidata item for this Wikipedia page and read
    the iNaturalist taxon ID from property P3151.
    """
    params = urllib.parse.urlencode({
        "action": "wbgetentities",
        "sites":  "enwiki",
        "titles": wiki_title,
        "props":  "claims",
        "format": "json",
    })
    data = api_get(f"https://www.wikidata.org/w/api.php?{params}")
    if not data:
        return None

    for entity in data.get("entities", {}).values():
        if entity.get("missing") == "":
            continue
        claims = entity.get("claims", {})
        # P3151 is the iNaturalist taxon ID property
        for claim in claims.get("P3151", []):
            try:
                inat_id = claim["mainsnak"]["datavalue"]["value"]
                return f"https://www.inaturalist.org/taxa/{inat_id}"
            except (KeyError, TypeError):
                continue
    return None


def find_inaturalist_url(wiki_title):
    """Try extlinks first, then fall back to Wikidata."""
    url = fetch_from_extlinks(wiki_title)
    if url:
        return url, "extlinks"

    url = fetch_from_wikidata(wiki_title)
    if url:
        return url, "wikidata"

    return None, None


def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        fish_list = json.load(f)

    print(f"Loaded {len(fish_list)} fish from '{INPUT_FILE}'")

    with open(BACKUP_FILE, "w", encoding="utf-8") as f:
        json.dump(fish_list, f, indent=2, ensure_ascii=False)
    print(f"Backup saved to '{BACKUP_FILE}'")

    total     = len(fish_list)
    found     = 0
    not_found = 0
    skipped   = 0

    for i, fish in enumerate(fish_list):
        name       = fish.get("name", "")
        wiki_title = fish.get("wiki_title", "")

        if fish.get("inaturalist_url"):
            skipped += 1
            continue

        if not wiki_title:
            fish["inaturalist_url"] = ""
            not_found += 1
            continue

        print(f"[{i+1}/{total}] {name} ({wiki_title})")
        url, source = find_inaturalist_url(wiki_title)

        if url:
            fish["inaturalist_url"] = url
            found += 1
            print(f"  Found ({source}): {url}")
        else:
            fish["inaturalist_url"] = ""
            not_found += 1
            print(f"  Not found")

        if (i + 1) % 25 == 0:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(fish_list, f, indent=2, ensure_ascii=False)
            print(f"  --- Saved ({found} found, {not_found} not found, {skipped} skipped) ---")

        time.sleep(DELAY)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(fish_list, f, indent=2, ensure_ascii=False)

    print(f"\nDone!")
    print(f"  Total:     {total}")
    print(f"  Found:     {found}")
    print(f"  Not found: {not_found}")
    print(f"  Skipped (already had URL): {skipped}")
    print(f"  Output:    {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
