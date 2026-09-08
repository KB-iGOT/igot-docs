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
import argparse, json, pathlib, sys

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
    for p in sorted(docs.rglob("*.md")):
        store[p.relative_to(docs).as_posix()] = p.read_text(encoding="utf-8")
    if not store:
        sys.exit(f"no .md files found under {docs}/")

    payload = json.dumps(store, ensure_ascii=False).replace("</", "<\\/")
    marked = pathlib.Path(a.marked).read_text(encoding="utf-8")

    out = tpl.replace("/*__MARKED_JS__*/", marked, 1)
    if "__MD_STORE__" not in out:
        sys.exit("template is missing the __MD_STORE__ placeholder")
    out = out.replace("__MD_STORE__", payload, 1)

    if a.mermaid:
        mm = pathlib.Path(a.mermaid).read_text(encoding="utf-8")
        cdn = '<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script>'
        out = out.replace(cdn, "<script>" + mm + "</script>", 1)

    pathlib.Path(a.out).write_text(out, encoding="utf-8")
    print(f"wrote {a.out}: {len(store)} markdown files embedded, {len(out)} bytes")

if __name__ == "__main__":
    main()
