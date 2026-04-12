import json
import time
import urllib.request
import urllib.parse
import urllib.error
import os

INPUT_FILE = "fish_names_backup.txt"   # your .txt file with one fish name per line
OUTPUT_FILE = "fish_data.json"  # the output JSON file
DELAY = 1.5                     # seconds between requests (be polite to Wikipedia)
MAX_RETRIES = 3                 # number of times to retry on a 429
RETRY_WAIT = 10                 # seconds to wait before retrying after a 429

def fetch_wikipedia_summary(fish_name):
    """Fetch summary and thumbnail from Wikipedia REST API."""
    encoded = urllib.parse.quote(fish_name.replace(" ", "_"))
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}"

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "FishWheelBot/1.0 (fish spinning wheel project)"}
    )

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode("utf-8"))

                if data.get("type") == "disambiguation":
                    return None

                return {
                    "name": fish_name,
                    "wiki_title": data.get("title", fish_name),
                    "description": data.get("description", ""),
                    "summary": data.get("extract", ""),
                    "image_url": data.get("thumbnail", {}).get("source", ""),
                    "full_image_url": data.get("originalimage", {}).get("source", ""),
                    "wiki_url": data.get("content_urls", {}).get("desktop", {}).get("page", ""),
                }

        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"  [429 Rate limited] Waiting {RETRY_WAIT}s before retry {attempt}/{MAX_RETRIES}...")
                time.sleep(RETRY_WAIT)
            elif e.code == 404:
                print(f"  [NOT FOUND] {fish_name}")
                return None
            else:
                print(f"  [HTTP {e.code}] {fish_name}")
                return None
        except Exception as e:
            print(f"  [ERROR] {fish_name}: {e}")
            return None

    print(f"  [GAVE UP] {fish_name} after {MAX_RETRIES} retries")
    return None


def try_fallback(fish_name):
    fallback_name = fish_name + " fish"
    print(f"  Trying fallback: '{fallback_name}'")
    result = fetch_wikipedia_summary(fallback_name)
    if result:
        result["name"] = fish_name
    return result


def load_existing(output_file):
    if os.path.exists(output_file):
        with open(output_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"Resuming — {len(data)} fish already fetched.")
        return {entry["name"]: entry for entry in data}
    return {}


def save(data_dict, output_file):
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(list(data_dict.values()), f, indent=2, ensure_ascii=False)


def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        fish_names = [line.strip() for line in f if line.strip()]

    print(f"Loaded {len(fish_names)} fish names from '{INPUT_FILE}'")

    results = load_existing(OUTPUT_FILE)
    already_done = set(results.keys())

    found = len(already_done)
    not_found = 0
    total = len(fish_names)

    for i, name in enumerate(fish_names):
        if name in already_done:
            continue

        print(f"[{i+1}/{total}] Fetching: {name}")
        data = fetch_wikipedia_summary(name)

        if data is None:
            data = try_fallback(name)

        if data:
            results[name] = data
            found += 1
            print(f"  OK — {data['description'] or '(no description)'}")
        else:
            results[name] = {
                "name": name,
                "wiki_title": "",
                "description": "",
                "summary": "",
                "image_url": "",
                "full_image_url": "",
                "wiki_url": "",
            }
            not_found += 1
            print(f"  No data found — placeholder stored.")

        if (i + 1) % 25 == 0:
            save(results, OUTPUT_FILE)
            print(f"  --- Progress saved ({found} found, {not_found} not found so far) ---")

        time.sleep(DELAY)

    save(results, OUTPUT_FILE)

    not_found_names = [
        entry["name"] for entry in results.values() if not entry["summary"]
    ]
    not_found_file = "fish_not_found.txt"
    with open(not_found_file, "w", encoding="utf-8") as f:
        f.write("\n".join(not_found_names))

    print(f"\nDone!")
    print(f"  Total fish:  {total}")
    print(f"  Found:       {found}")
    print(f"  Not found:   {not_found} (see '{not_found_file}')")
    print(f"  Output:      {OUTPUT_FILE}")


if __name__ == "__main__":
    main()