#!/usr/bin/env python3
"""
Generates the Learning Hub's hub-ring bubble layout (connector lines,
bubble positions, feature count) as a set of concentric, evenly-spaced
rings, and writes it into karmayogi-docs-explorer.template.html.

Why rings instead of one fixed ring: the original layout hardcoded
exactly 12 bubbles evenly spaced 30 degrees apart on one ring at radius
310. That's a wheel with a fixed number of spokes -- a 13th bubble has
nowhere to go at that radius without overlapping a neighbor.

This script keeps that first ring exactly as it was (all 12 legacy
bubbles are pinned to their original angle, so their pixel position is
unchanged) and adds new features to a second ring further out, evenly
spaced among whatever's on that ring. Each ring's capacity is computed
from its own circumference (bigger ring = more room), so when a ring
fills up the next feature automatically opens ring 3, then 4, and so on
-- nobody has to redesign the wheel by hand again.

Trade-off, stated plainly: bubbles on a *partially filled* outer ring can
shift a few degrees when a sibling joins that same ring (spacing =
360/count changes). A ring that's already full, and every inner ring,
never moves. This is different from a true phyllotaxis spiral (which
never moves *any* existing bubble) -- rings were chosen instead because
they look like the original, intentional wheel; a spiral only reads as
elegant once you have dozens of points, and at ~13-20 it just looks
scattered.

Usage:
    python3 tools/layout_hub_ring.py            # rewrite the template
    python3 tools/layout_hub_ring.py --check     # verify only, exit 1 on drift

After running, re-build the explorer as usual:
    python3 tools/build_docs_explorer.py
"""
import math
import re
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "karmayogi-docs-explorer.template.html"

# ─── The feature list ────────────────────────────────────────────────
# (id, label, size_px, font_size_px_or_None, extra, angle_deg_or_None)
#   id        -- must match the fdoc's data-fdoc="..." and openFeature('...')
#   label     -- visible text
#   size_px   -- bubble diameter; tune per label length (existing values
#                span 128-144px)
#   font_size -- None to use the button's default font-size
#   extra     -- "" | "assess" (adds the amber "assessment" styling) |
#                an attribute string like 'id="blended"' if some other
#                script needs to target this bubble by id
#   angle_deg -- the 12 original (pre-Sept-2026) features are PINNED at
#                their original angle on ring 1, so their pixel position
#                never changes. Leave this None for every new feature --
#                the script assigns it a ring and an angle automatically.
#
# To add a feature: append one tuple at the end with angle_deg=None, then
# run this script. That's the whole procedure.
FEATURES = [
    ("bharatkalp",     "Bharat Kalp",                       128, 14,   "",              0),
    ("blended",        "Blended Program",                   136, None, 'id="blended"',  30),
    ("chs",            "CHS",                               128, 14,   "",              60),
    ("assigned",       "My Assigned Courses",               136, 13.5, "",              90),
    ("eventshub",      "Events Hub",                        128, 14,   "",              120),
    ("standalone",     "Standalone Assessment",             136, 13.5, "assess",        150),
    ("peervalidation", "Peer Validation",                   136, 14,   "",              180),
    ("cap",            "Comprehensive Assessment Program",  144, 13,   "assess",        210),
    ("pathway",        "Learning Pathway",                  128, 14,   "",              240),
    ("course",         "Course",                            130, 15,   "",              270),
    ("aicbp",          "AI CBP Tool",                        136, 13.5, "",              300),
    ("curated",        "Curated Program",                   136, None, "",              330),
    ("competencyhub",  "Competency Hub",                    136, 13.5, "",              None),
]

# ─── Geometry constants ──────────────────────────────────────────────
CX, CY = 720, 505       # hub center -- matches .bub.center's box in the template
HUB_R = 102              # hub bubble radius (204px width / 2)
RING1_RADIUS = 310       # unchanged from the original design
RING_STEP = 170          # radius added per additional ring
SLOT = 160               # nominal (bubble diameter + gap) used to compute
                          # how many bubbles fit around a ring's circumference
RING2_START_OFFSET = 15  # rotate ring 2+ by half a ring-1 slot so a new
                          # bubble doesn't sit directly behind a ring-1 one

# The template's own JS (`fit()`) CSS-scales the 1440x900 "#stage" box to
# fit the viewport on BOTH axes and disables scrolling on desktop -- so
# every bubble must land inside these margins.
SAFE_X = (55, 1410)
SAFE_Y = (65, 885)


def ring_radius(ring_num):
    if ring_num == 1:
        return RING1_RADIUS
    return RING1_RADIUS + RING_STEP * (ring_num - 1)


def ring_capacity(ring_num):
    r = ring_radius(ring_num)
    return max(1, math.floor(2 * math.pi * r / SLOT))


def assign_rings():
    """Pinned (ring-1, explicit-angle) features go straight to their
    fixed spot. Every other feature, in FEATURES order, fills the first
    ring with spare capacity; once a ring is full the next feature opens
    the next ring."""
    pinned = [f for f in FEATURES if f[5] is not None]
    auto = [f for f in FEATURES if f[5] is None]

    ring1_capacity = ring_capacity(1)
    if len(pinned) > ring1_capacity:
        raise SystemExit(
            f"{len(pinned)} features are pinned to ring 1 but it only holds "
            f"{ring1_capacity} at SLOT={SLOT} -- widen SLOT or unpin some."
        )

    placed = {f[0]: dict(id=f[0], label=f[1], size=f[2], fs=f[3], extra=f[4],
                          ring=1, angle=f[5]) for f in pinned}

    ring_members = {1: list(pinned)}
    ring = 2
    for f in auto:
        while True:
            cap = ring_capacity(ring)
            cur = ring_members.get(ring, [])
            if len(cur) < cap:
                cur.append(f)
                ring_members[ring] = cur
                placed[f[0]] = dict(id=f[0], label=f[1], size=f[2], fs=f[3],
                                     extra=f[4], ring=ring, angle=None)
                break
            ring += 1

    # evenly space every ring's auto-angle members among themselves
    for ring_num, members in ring_members.items():
        if ring_num == 1:
            continue
        auto_members = [m for m in members if m[5] is None]
        n = len(auto_members)
        for idx, m in enumerate(auto_members):
            angle = RING2_START_OFFSET + (idx / n) * 360 if n else RING2_START_OFFSET
            placed[m[0]]["angle"] = angle

    # return in original FEATURES order
    return [placed[f[0]] for f in FEATURES]


def compute_positions(items):
    pts = []
    for it in items:
        r = ring_radius(it["ring"])
        theta = math.radians(it["angle"])
        bx = CX + r * math.cos(theta)
        by = CY + r * math.sin(theta)
        pts.append(dict(it, bx=bx, by=by, rad=it["size"] / 2, r=r))
    return pts


def check_geometry(pts):
    problems = []
    for p in pts:
        if not (SAFE_X[0] <= p["bx"] - p["rad"] and p["bx"] + p["rad"] <= SAFE_X[1]
                and SAFE_Y[0] <= p["by"] - p["rad"] and p["by"] + p["rad"] <= SAFE_Y[1]):
            problems.append(f'{p["id"]} falls outside the safe canvas margins')
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            a, b = pts[i], pts[j]
            d = math.hypot(a["bx"] - b["bx"], a["by"] - b["by"]) - (a["rad"] + b["rad"])
            if d < 0:
                problems.append(f'{a["id"]} overlaps {b["id"]} by {-d:.1f}px')
    for p in pts:
        d = math.hypot(p["bx"] - CX, p["by"] - CY) - (HUB_R + p["rad"])
        if d < 0:
            problems.append(f'{p["id"]} overlaps the center hub by {-d:.1f}px')
    return problems


def render_block(pts):
    lines, buttons = [], []
    rings_in_use = sorted(set(p["ring"] for p in pts))
    for p in pts:
        bx, by = round(p["bx"]), round(p["by"])
        left, top = round(p["bx"] - p["size"] / 2), round(p["by"] - p["size"] / 2)
        lines.append(
            f'      <line x1="{CX}" y1="{CY}" x2="{bx}" y2="{by}" '
            f'stroke="#1B4CA138" stroke-width="1.5" stroke-dasharray="4 6"/>'
        )
        cls = "bub item assess" if p["extra"] == "assess" else "bub item"
        extra_attr = f' {p["extra"]}' if p["extra"] and p["extra"] != "assess" else ""
        fs = f' font-size:{p["fs"]}px' if p["fs"] else ""
        buttons.append(
            f'    <button class="{cls}"{extra_attr} style="left:{left}px; top:{top}px; '
            f'width:{p["size"]}px; height:{p["size"]}px;{fs}" '
            f"onclick=\"openFeature('{p['id']}')\">{p['label']}</button>"
        )

    guide_circles = [
        f'      <circle cx="{CX}" cy="{CY}" r="{ring_radius(r)}" stroke="#1B4CA126" '
        f'stroke-width="1.5" stroke-dasharray="5 7"/>'
        for r in rings_in_use
    ]

    n = len(pts)
    parts = [
        "    <!-- HUB-RING:BEGIN — generated by tools/layout_hub_ring.py, do not hand-edit.",
        "         To add/remove a feature, edit the FEATURES list in that script and re-run it;",
        "         it rewrites everything between these two markers (lines + buttons + count). -->",
        '    <svg class="orbitbg" width="1440" height="900" fill="none">',
        *lines,
        *guide_circles,
        "    </svg>",
        "",
        '    <div class="bub center" style="left:618px; top:403px; width:204px; height:204px;">',
        '      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5h7a2 2 0 0 1 2 2V20a2.5 2.5 0 0 0-2.5-2H3z"/><path d="M21 5.5h-7a2 2 0 0 0-2 2V20a2.5 2.5 0 0 1 2.5-2H21z"/></svg>',
        '      <div style="font-weight:900; font-size:18px; letter-spacing:-0.02em">Learning Hub</div>',
        f'      <div class="sub">{n} features</div>',
        "    </div>",
        "",
        *buttons,
        "    <!-- HUB-RING:END -->",
    ]
    return "\n".join(parts)


MARKER_RE = re.compile(r"    <!-- HUB-RING:BEGIN.*?HUB-RING:END -->", re.S)
LANDING_COUNT_RE = re.compile(
    r'(<button class="bub hub" id="learn-hub"[^>]*>\s*Learning Hub<span class="sub">)\d+( features</span>)'
)


def main():
    check_only = "--check" in sys.argv

    items = assign_rings()
    pts = compute_positions(items)
    problems = check_geometry(pts)
    if problems:
        raise SystemExit("Layout has problems, fix FEATURES/constants and re-run:\n  " + "\n  ".join(problems))

    new_block = render_block(pts)

    html = TEMPLATE.read_text()
    if not MARKER_RE.search(html):
        raise SystemExit("HUB-RING:BEGIN/END markers not found in the template.")
    updated = MARKER_RE.sub(lambda _: new_block, html, count=1)

    if not LANDING_COUNT_RE.search(updated):
        raise SystemExit("Landing page's Learning Hub feature-count span not found.")
    updated = LANDING_COUNT_RE.sub(rf"\g<1>{len(pts)}\g<2>", updated, count=1)

    ring_counts = {}
    for p in pts:
        ring_counts[p["ring"]] = ring_counts.get(p["ring"], 0) + 1
    summary = ", ".join(f"ring {r}: {c}/{ring_capacity(r)}" for r, c in sorted(ring_counts.items()))
    print(f"laid out {len(pts)} features -- {summary}")

    if check_only:
        if updated != html:
            sys.stderr.write(
                "template is out of date with FEATURES -- run "
                "`python3 tools/layout_hub_ring.py` and commit the result.\n"
            )
            sys.exit(1)
        print("template matches freshly computed layout.")
        return

    TEMPLATE.write_text(updated)
    print(f"wrote {TEMPLATE.name}")


if __name__ == "__main__":
    main()
