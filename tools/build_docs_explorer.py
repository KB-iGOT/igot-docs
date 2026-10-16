#!/usr/bin/env python3
"""Build karmayogi-docs-explorer.html from the markdown docs tree.

The template carries the UI; every feature tab is an <article data-md="...">
placeholder. This script injects (a) marked.min.js and (b) a JSON store of
every .md file under docs/, so the HTML renders the markdown as its single
source of truth. Re-run after editing any .md.

Usage (from the iGOT-Doc folder):
    python3 tools/build_docs_explorer.py \
        [--template karmayogi-docs-explorer.template.html] \
        [--docs docs] [--marked tools/marked.min.js] \
        [--out karmayogi-docs-explorer.html]
"""
import argparse, base64, json, mimetypes, pathlib, re, subprocess, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", default="karmayogi-docs-explorer.template.html")
    ap.add_argument("--docs", default="docs")
    ap.add_argument("--marked", default="tools/marked.min.js")
    ap.add_argument("--out", default="karmayogi-docs-explorer.html")
    ap.add_argument("--mermaid", default=None,
                    help="path to mermaid.min.js to inline (for offline/NIC hosting); default keeps the CDN tag")
    a = ap.parse_args()

    tpl = pathlib.Path(a.template).read_text(encoding="utf-8")
    docs = pathlib.Path(a.docs)
    store = {}
    images = {}  # repo-relative path -> data URI, one entry per image however often it is used
    IMG_EXT = r"png|jpe?g|webp|gif|svg"

    def _register(path):
        if not path.is_file():
            return False
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        images[path.as_posix()] = "data:%s;base64,%s" % (mime, base64.b64encode(path.read_bytes()).decode("ascii"))
        return True

    def _md_images(md_path, text):
        # markdown images are written relative to their .md file (so MkDocs and
        # GitHub render them); rewrite them to repo-relative paths in the embedded copy
        def sub(m):
            target = (md_path.parent / m.group(2))
            if m.group(2).startswith(("http:", "https:", "data:")) or not _register(target):
                return m.group(0)
            return m.group(1) + target.as_posix() + m.group(3)
        text = re.sub(r"(!\[[^\]]*\]\()([^)\s]+\.(?:%s))(\))" % IMG_EXT, sub, text)
        # raw <img src="..."> tags (used where an image needs an explicit width)
        return re.sub(r'(<img\b[^>]*?\bsrc=")([^"\s]+\.(?:%s))(")' % IMG_EXT, sub, text)

    for p in sorted(docs.rglob("*.md")):
        store[p.relative_to(docs).as_posix()] = _md_images(p, p.read_text(encoding="utf-8"))
    if not store:
        sys.exit(f"no .md files found under {docs}/")

    payload = json.dumps(store, ensure_ascii=False).replace("</", "<\\/")
    marked = pathlib.Path(a.marked).read_text(encoding="utf-8")

    out = tpl.replace("/*__MARKED_JS__*/", marked, 1)
    if "__MD_STORE__" not in out:
        sys.exit("template is missing the __MD_STORE__ placeholder")
    out = out.replace("__MD_STORE__", payload, 1)

    # images the hand-written template references as src="docs/..." share the same store
    for m in re.finditer(r'src="(docs/[^"]+\.(?:%s))"' % IMG_EXT, out):
        _register(pathlib.Path(m.group(1)))
    if images:
        img_json = json.dumps(images).replace("</", "<\\/")
        hook = (
            '<script id="img-store" type="application/json">' + img_json + '</script>\n'
            '<script>(function(){var S=JSON.parse(document.getElementById("img-store").textContent);'
            'function fix(i){var s=i.getAttribute("src");if(s&&S[s])i.src=S[s];}'
            'function all(r){(r.querySelectorAll?r.querySelectorAll("img"):[]).forEach(fix);}'
            'all(document);new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){'
            'if(n.nodeType===1){if(n.tagName==="IMG")fix(n);else all(n);}});'
            'if(m.type==="attributes")fix(m.target);});}).observe(document.documentElement,'
            '{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});})();</script>\n'
        )
        i = out.rfind("</body>")
        out = out[:i] + hook + out[i:] if i != -1 else out + hook

    # last-commit date of each feature's docs folder, shown as "Last Updated" on its page
    dates = {}
    for d in sorted({pathlib.PurePosixPath(k).parent.as_posix() for k in store if "/" in k}):
        try:
            r = subprocess.run(["git", "log", "-1", "--format=%cs", "--", (docs / d).as_posix()],
                               capture_output=True, text=True, timeout=20)
            if r.returncode == 0 and r.stdout.strip():
                dates[d] = r.stdout.strip()
        except (OSError, subprocess.SubprocessError):
            break  # no git: pages simply show no date
    tag = '<script id="doc-dates" type="application/json">' + json.dumps(dates) + '</script>\n'
    out = out.replace('<script id="md-store"', tag + '<script id="md-store"', 1)

    if a.mermaid:
        mm = pathlib.Path(a.mermaid).read_text(encoding="utf-8")
        cdn = '<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script>'
        out = out.replace(cdn, "<script>" + mm + "</script>", 1)

    pathlib.Path(a.out).write_text(out, encoding="utf-8")
    print(f"wrote {a.out}: {len(store)} markdown files embedded, {len(out)} bytes")

if __name__ == "__main__":
    main()
