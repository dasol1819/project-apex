"""Read-only DNS/HTTP/TLS/Pages diagnostics; never disable certificate validation."""
import concurrent.futures
import datetime
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
DOMAIN = "project-apex.kro.kr"
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "dasol1819/project-apex")
OUT = Path(os.environ.get("APEX_TEST_OUTPUT", "artifacts/connection"))
OUT.mkdir(parents=True, exist_ok=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(url, *, headers=None, redirect=True):
    opener = urllib.request.build_opener() if redirect else urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(urllib.request.Request(url, headers=headers or {}), timeout=25) as response:
            body = response.read(4 * 1024 * 1024)
            return {"ok": True, "status": response.status, "url": response.url,
                    "contentType": response.headers.get("Content-Type"), "bytes": len(body),
                    "sha256": hashlib.sha256(body).hexdigest()}, body
    except urllib.error.HTTPError as error:
        return {"ok": False, "status": error.code, "url": error.url,
                "location": error.headers.get("Location"), "error": error.read(1500).decode(errors="replace")}, None
    except Exception as error:
        return {"ok": False, "url": url, "error": str(error)}, None


def dns(kind):
    result, body = request("https://dns.google/resolve?" + urllib.parse.urlencode({"name": DOMAIN, "type": kind}))
    return kind, json.loads(body) if body else result


def connection(name, url):
    result, _ = request(url, redirect=False)
    return name, result


report = {"checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "repository": REPOSITORY, "domain": DOMAIN, "dns": {}, "connections": {}}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    dns_results = list(pool.map(dns, ["CNAME", "A", "AAAA", "CAA"]))
    report["dns"].update(dns_results)
    targets = [("http", f"http://{DOMAIN}/"), ("https", f"https://{DOMAIN}/"),
               ("githubPages", "https://dasol1819.github.io/project-apex/")]
    report["connections"].update(pool.map(lambda item: connection(*item), targets))
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        # The token is sent only to the fixed GitHub API origin, never printed or saved.
        headers = {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json"}
        for key, suffix in [("pages", "pages"), ("pagesHealth", "pages/health")]:
            result, body = request(f"https://api.github.com/repos/{REPOSITORY}/{suffix}", headers=headers)
            report[key] = json.loads(body) if body else result
    for path in ["index.html", "app.js", "mig15bis-model.js", "flight.wasm"]:
        result, body = request(f"http://{DOMAIN}/{path}")
        source = ROOT / "public" / path
        result["matchesCheckout"] = bool(body and source.is_file() and body == source.read_bytes())
        report.setdefault("deployedFiles", {})[path] = result
report["httpsPassed"] = report["connections"]["https"].get("status") == 200
(OUT / "connection.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(report, indent=2, ensure_ascii=False))
if "--require-https" in sys.argv and not report["httpsPassed"]:
    sys.exit(1)
