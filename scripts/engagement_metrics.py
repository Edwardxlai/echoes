# -*- coding: utf-8 -*-
"""Fetch public Douyin engagement counters for one aweme with an F2 visitor cookie."""
import asyncio
import json
import os
import sys

AWEME_ID = sys.argv[1]
OUT = sys.argv[2]
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def write(payload):
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)


try:
    from f2.log.logger import logger
    logger.remove()
except Exception:
    pass


async def main():
    from f2.apps.douyin.handler import DouyinHandler
    from f2.apps.douyin.utils import TokenManager

    ttwid = TokenManager.gen_ttwid()
    ms_token = TokenManager.gen_real_msToken()
    handler = DouyinHandler({
        "headers": {"User-Agent": UA, "Referer": "https://www.douyin.com/"},
        "cookie": f"ttwid={ttwid}; msToken={ms_token}",
        "proxies": {"http://": None, "https://": None},
        "timeout": 20,
        "mode": "one",
    })
    video = await handler.fetch_one_video(AWEME_ID)
    data = video._to_dict()

    def counter(name):
        value = data.get(name)
        if isinstance(value, list):
            value = value[0] if value else None
        return int(value) if value is not None else None

    values = {
        "like_count": counter("digg_count"),
        "collect_count": counter("collect_count"),
        "comment_count": counter("comment_count"),
        "share_count": counter("share_count"),
    }
    if values["like_count"] is None or values["collect_count"] is None:
        raise RuntimeError("missing like or collect count")
    write({"ok": True, **values})


try:
    asyncio.run(main())
except Exception as error:
    write({"ok": False, "error": str(error)[:200]})
os._exit(0)
