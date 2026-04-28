import re
from html import unescape
from typing import List, Optional
from urllib.parse import quote_plus
from xml.etree import ElementTree

import httpx

from app.models.ingestion import RawScrapePayload


HTML_TAG_RE = re.compile(r'<[^>]+>')
ANCHOR_HREF_RE = re.compile(r'<a[^>]*href="[^"]*"[^>]*>', re.I)
WHITESPACE_RE = re.compile(r'\s+')


def clean_html_fragment(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = unescape(value)
    text = ANCHOR_HREF_RE.sub(' ', text)
    text = HTML_TAG_RE.sub(' ', text)
    text = text.replace('Google News', ' ')
    text = text.replace('amp;', ' ')
    text = WHITESPACE_RE.sub(' ', text).strip(' -–|')
    return text or None


def build_summary(title: Optional[str], description: Optional[str]) -> Optional[str]:
    clean_title = clean_html_fragment(title)
    clean_description = clean_html_fragment(description)
    if clean_description and clean_title:
        lowered = clean_description.lower()
        if lowered.startswith(clean_title.lower()):
            clean_description = clean_description[len(clean_title):].strip(' :-|') or None
    summary = clean_description or clean_title
    if summary and len(summary) > 280:
        summary = summary[:277].rstrip() + '...'
    return summary or None


def build_google_news_rss_url(query: str) -> str:
    return (
        'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q='
        + quote_plus(query)
    )


async def fetch_google_news_rss(query: str) -> List[RawScrapePayload]:
    url = build_google_news_rss_url(query)
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()

    root = ElementTree.fromstring(response.text)
    channel = root.find('channel')
    if channel is None:
        return []

    items: List[RawScrapePayload] = []
    for item in channel.findall('item')[:10]:
        title = item.findtext('title')
        link = item.findtext('link')
        pub_date = item.findtext('pubDate')
        raw_description = item.findtext('description')
        description = build_summary(title, raw_description)

        if not title or not link:
            continue

        items.append(
            RawScrapePayload(
                source_name='google_news_rss',
                source_url=link,
                title=title,
                raw_text=description,
                published_at=pub_date,
                payload={
                    'query': query,
                    'description': description,
                    'raw_description': clean_html_fragment(raw_description),
                    'provider': 'google_news_rss',
                },
            )
        )

    return items
