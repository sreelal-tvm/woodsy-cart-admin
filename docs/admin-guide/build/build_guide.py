"""Builds the Admin guide PDF (and optionally fresh screenshots) from WoodsyCart-Admin-Guide.md.

Usage (from docs/admin-guide):
    python build/build_guide.py shots --auth auth.json   # screenshots of the running Admin app (localhost:4300)
    python build/build_guide.py pdf                      # WoodsyCart-Admin-Guide.pdf

Needs Microsoft Edge (or Chrome) and the `websockets` package. auth.json holds the value of the Admin app's
localStorage "wc_admin_auth" (sign in, then copy it from the browser) — delete it afterwards.
Personal data in screenshots (customer names, phones, addresses, emails) is replaced with sample data via --mask.
"""
import argparse
import asyncio
import base64
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import websockets

HERE = os.path.dirname(os.path.abspath(__file__))
GUIDE_DIR = os.path.dirname(HERE)
MD = os.path.join(GUIDE_DIR, "WoodsyCart-Admin-Guide.md")
IMAGES = os.path.join(GUIDE_DIR, "images")
PDF = os.path.join(GUIDE_DIR, "WoodsyCart-Admin-Guide.pdf")
ADMIN = "http://localhost:4300"
BROWSERS = [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe"]


# ---------------------------------------------------------------- Markdown → HTML (the subset the guide uses)

def inline(t: str) -> str:
    t = html.escape(t, quote=False)
    t = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", lambda m: img_tag(m.group(2), m.group(1)), t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![*\w])\*([^*\n]+)\*(?!\w)", r"<em>\1</em>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    return t


def img_tag(src: str, alt: str) -> str:
    path = os.path.join(GUIDE_DIR, src)
    if os.path.exists(path):
        data = base64.b64encode(open(path, "rb").read()).decode()
        mime = "image/png" if src.endswith(".png") else "image/jpeg"
        return f'<figure><img src="data:{mime};base64,{data}" alt="{html.escape(alt)}"/><figcaption>{html.escape(alt)}</figcaption></figure>'
    return f'<figure class="missing"><div>Screenshot: {html.escape(alt)}</div></figure>'


def slug(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"\s", "-", s)


def md_to_html(md: str) -> str:
    lines = md.split("\n")
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            j = i + 1
            while j < len(lines) and not lines[j].startswith("```"):
                j += 1
            out.append("<pre>" + html.escape("\n".join(lines[i + 1:j])) + "</pre>")
            i = j + 1
            continue
        m = re.match(r"^(#{1,4}) (.*)$", line)
        if m:
            lvl, text = len(m.group(1)), m.group(2)
            out.append(f'<h{lvl} id="{slug(text)}">{inline(text)}</h{lvl}>')
            i += 1
            continue
        if line.strip() == "---":
            out.append("<hr/>")
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            head, body = rows[0], [r for r in rows[2:]]
            t = "<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
            t += "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
            out.append(t + "</tbody></table>")
            continue
        if line.startswith(">"):
            block = []
            while i < len(lines) and lines[i].startswith(">"):
                block.append(lines[i][1:].strip())
                i += 1
            text = " ".join(block)
            cls = "warn" if "Watch out" in text else "tip"
            out.append(f'<blockquote class="{cls}">{inline(text)}</blockquote>')
            continue
        if re.match(r"^\s*([-*]|\d+\.) ", line):
            i = list_block(lines, i, out)
            continue
        if line.strip().startswith("!["):
            out.append(inline(line.strip()))
            i += 1
            continue
        if not line.strip():
            i += 1
            continue
        para = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#|\||>|```|---|\s*([-*]|\d+\.) )", lines[i]):
            para.append(lines[i])
            i += 1
        out.append("<p>" + inline(" ".join(para)) + "</p>")
    return "\n".join(out)


def list_block(lines, i, out, indent=0):
    ordered = bool(re.match(r"^\s*\d+\. ", lines[i]))
    out.append("<ol>" if ordered else "<ul>")
    while i < len(lines):
        m = re.match(r"^(\s*)([-*]|\d+\.) (.*)$", lines[i])
        if not m:
            break
        ind = len(m.group(1))
        if ind < indent:
            break
        if ind > indent:
            i = list_block(lines, i, out, ind)
            continue
        item = m.group(3)
        i += 1
        out.append("<li>" + inline(item))
        if i < len(lines) and re.match(r"^(\s*)([-*]|\d+\.) ", lines[i]) and len(re.match(r"^(\s*)", lines[i]).group(1)) > indent:
            i = list_block(lines, i, out, len(re.match(r"^(\s*)", lines[i]).group(1)))
        out.append("</li>")
    out.append("</ol>" if ordered else "</ul>")
    return i


CSS = """
@page { size: A4; margin: 16mm 14mm 18mm 14mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1f2937; }
h1 { font-size: 24pt; color: #0f172a; margin: 0 0 6pt; }
h2 { font-size: 17pt; color: #1d4ed8; border-bottom: 2px solid #dbeafe; padding-bottom: 4pt; margin-top: 0; page-break-before: always; }
h3 { font-size: 12.5pt; color: #0f172a; margin: 16pt 0 6pt; page-break-after: avoid; }
h4 { font-size: 11pt; margin: 12pt 0 4pt; }
p { margin: 5pt 0; }
a { color: #1d4ed8; text-decoration: none; }
code { background: #f1f5f9; padding: 0 3pt; border-radius: 3pt; font-size: 9.5pt; }
pre { background: #0f172a; color: #e2e8f0; padding: 9pt 11pt; border-radius: 6pt; font-size: 9pt; line-height: 1.45; white-space: pre-wrap; page-break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 7pt 0 10pt; font-size: 9.5pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: #eff6ff; color: #1e3a8a; text-align: left; padding: 5pt 7pt; border: 1px solid #dbeafe; }
td { padding: 4.5pt 7pt; border: 1px solid #e5e7eb; vertical-align: top; }
tr:nth-child(even) td { background: #fafafa; }
ul, ol { margin: 4pt 0 6pt; padding-left: 18pt; }
li { margin: 2pt 0; }
blockquote { margin: 9pt 0; padding: 8pt 11pt; border-radius: 6pt; page-break-inside: avoid; }
blockquote.tip { background: #ecfdf5; border-left: 4px solid #10b981; }
blockquote.warn { background: #fff7ed; border-left: 4px solid #f97316; }
figure { margin: 9pt 0 12pt; text-align: center; page-break-inside: avoid; }
figure img { max-width: 100%; max-height: 165mm; border: 1px solid #d1d5db; border-radius: 6pt; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
figcaption { font-size: 8.5pt; color: #6b7280; margin-top: 3pt; }
figure.missing div { border: 2px dashed #cbd5e1; color: #94a3b8; padding: 30pt; border-radius: 6pt; }
hr { border: 0; border-top: 1px solid #e5e7eb; margin: 12pt 0; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.cover .logo { font-size: 40pt; font-weight: 800; color: #0f172a; letter-spacing: -1px; }
.cover .logo span { color: #3874ff; }
.cover .t { font-size: 22pt; font-weight: 700; margin-top: 18pt; }
.cover .s { font-size: 12pt; color: #6b7280; margin-top: 8pt; }
.cover .v { margin-top: 40pt; font-size: 10pt; color: #9ca3af; }
"""


def build_html() -> str:
    md = open(MD, encoding="utf8").read()
    # The first H1 + subtitle become the cover page.
    md = re.sub(r"^# .*\n\n\*[^\n]*\*\n\nVersion[^\n]*\n", "", md, count=1)
    body = md_to_html(md)
    body = body.replace("<h2", "<h2", 1)
    cover = """<div class="cover"><div class="logo">woodsy<span>cart</span></div>
      <div class="t">Admin App — Complete User Guide</div>
      <div class="s">Every screen, tab, label, button and calculation explained</div>
      <div class="v">Version 1.0 · October 2026</div></div>"""
    # The first chapter heading shouldn't force an empty page after the contents heading.
    return f"<!doctype html><html><head><meta charset='utf-8'><title>WoodsyCart Admin Guide</title><style>{CSS}</style></head><body>{cover}{body}</body></html>"


# ---------------------------------------------------------------- Browser (Chrome DevTools Protocol)

class Browser:
    def __init__(self):
        exe = next((b for b in BROWSERS if os.path.exists(b)), None)
        if not exe:
            sys.exit("Microsoft Edge or Google Chrome is required.")
        self.profile = tempfile.mkdtemp(prefix="wc-guide-")
        self.port = 9333
        self.proc = subprocess.Popen([exe, "--headless=new", f"--remote-debugging-port={self.port}", f"--user-data-dir={self.profile}",
                                      "--no-first-run", "--hide-scrollbars", "--force-color-profile=srgb", "about:blank"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json"))
                self.ws_url = next(t for t in tabs if t["type"] == "page")["webSocketDebuggerUrl"]
                return
            except Exception:
                time.sleep(0.2)
        sys.exit("Could not start the browser.")

    async def __aenter__(self):
        self.ws = await websockets.connect(self.ws_url, max_size=200_000_000)
        self.n = 0
        return self

    async def __aexit__(self, *a):
        await self.ws.close()
        self.proc.kill()
        shutil.rmtree(self.profile, ignore_errors=True)

    async def send(self, method, **params):
        self.n += 1
        my = self.n
        await self.ws.send(json.dumps({"id": my, "method": method, "params": params}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get("id") == my:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    async def js(self, expr):
        r = await self.send("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        return r.get("result", {}).get("value")

    async def goto(self, url, wait=3.0):
        await self.send("Page.navigate", url=url)
        await asyncio.sleep(wait)


# ---------------------------------------------------------------- Screenshots

def mask_script(pairs):
    """Replaces real customer details with sample ones everywhere on the page (text and input values)."""
    data = json.dumps(pairs)
    return f"""(() => {{
      const pairs = {data};
      const fix = s => pairs.reduce((t, [a, b]) => a ? t.split(a).join(b) : t, s);
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {{ const n = w.currentNode; const v = fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }}
      document.querySelectorAll('input, textarea').forEach(i => {{ const v = fix(i.value); if (v !== i.value) i.value = v; }});
      document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]').forEach(a => a.removeAttribute('href'));
      return true;
    }})()"""


def click_text(selector, text):
    return f"""(() => {{ const el = [...document.querySelectorAll({json.dumps(selector)})].find(e => e.textContent.trim().startsWith({json.dumps(text)}));
      if (el) el.click(); return !!el; }})()"""


SHOTS = [
    # (file, path, actions before the shot)
    ("02-dashboard", "/dashboard", []),
    ("03-orders", "/orders", []),
    ("04-order-detail", "/orders/{order_id}", []),
    ("07-customers", "/customers", []),
    ("08-customer-detail", "/customers/{customer_id}", []),
    ("09-refunds", "/refunds", [click_text(".filter-pills a", "All")]),
    ("10-enquiries", "/enquiries", []),
    ("11-products", "/products", []),
    ("12-product-edit", "/products/{product_id}", []),
    ("13-product-options", "/products/{product_id}", [click_text(".nav-link", "Options"), "document.querySelector('wc-product-options')?.scrollIntoView({block: 'start'}); window.scrollBy(0, -90)"]),
    ("14-categories", "/categories", []),
    ("15-image-cleaning", "/image-cleaning", []),
    ("16-reviews", "/reviews", [click_text(".filter-pills a", "All")]),
    ("17-offers", "/offers", []),
    ("18-offer-form", "/offers", [click_text("button", "New offer"), click_text(".wc-modal button", "Diwali")]),
    ("19-coupons", "/coupons", []),
    ("20-banners", "/banners", []),
    ("21-vendors", "/vendors", []),
    ("22-vendor-bills", "/vendor-bills", []),
    ("23-profit-loss", "/profit-loss", ["(() => { const s = document.querySelector('select'); s.value = 'fy'; s.dispatchEvent(new Event('change')); return true; })()"]),
    ("24-invoices", "/invoices", []),
    ("25-expenses", "/expenses", []),
    ("26-payments-methods", "/payments", []),
    ("27-payments-providers", "/payments", [click_text(".nav-link", "Providers")]),
    ("28-payments-upi", "/payments", [click_text(".nav-link", "UPI verification"),
                                      "document.querySelectorAll('input[readonly]').forEach(i => i.value = 'https://api.woodsycart.in/api/payments/upi/alert?key=••••••••••••')"]),
    ("29-pincodes", "/pincodes", []),
    ("30-settings-business", "/settings", []),
    ("31-settings-pricing", "/settings", [click_text(".nav-link", "Pricing")]),
    ("32-settings-checkout", "/settings", [click_text(".nav-link", "Checkout")]),
]


async def take_shots(auth_json: str, mask_pairs, ids):
    os.makedirs(IMAGES, exist_ok=True)
    async with Browser() as b:
        await b.send("Page.enable")
        await b.send("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1.5, mobile=False)
        await b.goto(ADMIN + "/login", 4)
        await save(b, "01-login")
        await b.js(f"localStorage.setItem('wc_admin_auth', {json.dumps(auth_json)}); localStorage.setItem('wc_admin_theme', 'light'); true")
        for name, path, actions in SHOTS:
            await b.goto(ADMIN + path.format(**ids), 3.5)
            for a in actions:
                await b.js(a)
                await asyncio.sleep(1.2)
            await b.js(mask_script(mask_pairs))
            await asyncio.sleep(0.3)
            await save(b, name)
        await b.js("localStorage.clear(); true")


async def save(b, name):
    shot = await b.send("Page.captureScreenshot", format="png")
    open(os.path.join(IMAGES, name + ".png"), "wb").write(base64.b64decode(shot["data"]))
    print("  saved", name)


# ---------------------------------------------------------------- PDF

async def make_pdf():
    page = build_html()
    tmp = os.path.join(tempfile.gettempdir(), "wc-admin-guide.html")
    open(tmp, "w", encoding="utf8").write(page)
    async with Browser() as b:
        await b.send("Page.enable")
        await b.goto("file:///" + tmp.replace("\\", "/"), 2)
        footer = ('<div style="font-size:8px;width:100%;padding:0 14mm;color:#9ca3af;display:flex;justify-content:space-between;font-family:Segoe UI,Arial">'
                  '<span>WoodsyCart Admin — User Guide</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>')
        r = await b.send("Page.printToPDF", printBackground=True, preferCSSPageSize=True, displayHeaderFooter=True,
                         headerTemplate="<span></span>", footerTemplate=footer, generateDocumentOutline=True, generateTaggedPDF=True)
        open(PDF, "wb").write(base64.b64decode(r["data"]))
    os.remove(tmp)
    print("PDF written:", PDF)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("what", choices=["shots", "pdf"])
    ap.add_argument("--auth", help="file with the wc_admin_auth JSON (for shots)")
    ap.add_argument("--mask", help="JSON file: [[real, sample], …] replacements for personal data")
    ap.add_argument("--ids", default='{"order_id": 10, "customer_id": 6, "product_id": 237}')
    a = ap.parse_args()
    if a.what == "shots":
        auth = open(a.auth, encoding="utf8").read().strip()
        pairs = json.load(open(a.mask, encoding="utf8")) if a.mask else []
        asyncio.run(take_shots(auth, pairs, json.loads(a.ids)))
    else:
        asyncio.run(make_pdf())


if __name__ == "__main__":
    main()
