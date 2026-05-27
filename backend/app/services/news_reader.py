from __future__ import annotations

import logging
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

ALLOWED_TAGS = {
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code", "br",
    "strong", "b", "em", "i", "a", "img",
    "table", "thead", "tbody", "tr", "td", "th",
    "span", "div", "hr", "sub", "sup", "dl", "dt", "dd",
}

STRIP_SELECTORS = [
    "script", "style", "iframe", "nav", "footer", "header",
    "[class*='ad']", "[id*='ad']",
    "[class*='sidebar']", "[id*='sidebar']",
    "[class*='comment']", "[id*='comment']",
    "[class*='recommend']", "[class*='related']",
    "[class*='share']", "[class*='hot']",
]

CONTENT_SELECTORS = [
    "div#artibody",
    "div#ContentBody",
    "div.articleContent",
    "div.detailContent",
    "div.detail-content",
    "div.article-con",
    "div.article-content",
    "div.article_body",
    "div#Article",
    "div.article",
    "div.main-content",
    "div.post-content",
    "div.entry-content",
    "article",
    "[itemprop='articleBody']",
]


async def _fetch_page(url: str, timeout: int = 15) -> str:
    """Fetch a URL and return decoded HTML text."""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=BROWSER_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()

        content_type = resp.headers.get("content-type", "")
        if "html" not in content_type and "text" not in content_type:
            raise ValueError("URL 返回的不是网页内容")

        try:
            return resp.text
        except UnicodeDecodeError:
            return resp.content.decode("gbk", errors="replace")


async def fetch_and_proxy(url: str) -> str:
    """Fetch a page and inject <base> tag so it can be embedded in an iframe."""
    html = await _fetch_page(url)
    soup = BeautifulSoup(html, "html.parser")

    head = soup.find("head")
    if not head:
        head = soup.new_tag("head")
        if soup.html:
            soup.html.insert(0, head)
        else:
            soup.insert(0, head)

    base = soup.new_tag("base", href=url)
    head.insert(0, base)

    return str(soup)


async def extract_content(url: str) -> dict:
    """Fetch a news article and extract its main content."""
    html = await _fetch_page(url)
    soup = BeautifulSoup(html, "html.parser")

    title = ""
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
    if not title:
        t = soup.find("title")
        if t:
            title = t.get_text(strip=True)

    body = None
    for selector in CONTENT_SELECTORS:
        body = soup.select_one(selector)
        if body and len(body.get_text(strip=True)) > 80:
            break
        body = None

    if body is None:
        candidates = []
        for div in soup.find_all(["div", "article", "section"]):
            p_tags = div.find_all("p")
            text_len = sum(len(p.get_text(strip=True)) for p in p_tags)
            if len(p_tags) >= 2 and text_len > 100:
                candidates.append((text_len, div))
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            body = candidates[0][1]

    if body is None:
        return {"title": title, "content": "<p>无法提取文章内容，请尝试其他阅读模式</p>", "source_url": url}

    for s in body.select(", ".join(STRIP_SELECTORS)):
        s.decompose()

    for tag in body.find_all(True):
        if tag.name not in ALLOWED_TAGS:
            tag.unwrap()
        else:
            attrs_to_keep = {}
            if tag.name == "a" and tag.get("href"):
                attrs_to_keep["href"] = urljoin(url, tag["href"])
            elif tag.name == "img":
                if tag.get("src"):
                    attrs_to_keep["src"] = urljoin(url, tag["src"])
                if tag.get("alt"):
                    attrs_to_keep["alt"] = tag["alt"]
            tag.attrs = attrs_to_keep

    content_html = "".join(str(c) for c in body.contents) if body.contents else body.decode_contents()
    content_html = content_html.strip()

    if not content_html:
        content_html = "<p>无法提取文章内容，请尝试其他阅读模式</p>"

    return {"title": title, "content": content_html, "source_url": url}
