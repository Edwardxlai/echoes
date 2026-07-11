# -*- coding: utf-8 -*-
# 枚举一个抖音合集(mix)的视频列表，用 f2 自造的游客 cookie（无需登录）。
# 用法：python mix_enum.py <mix_id> <out_json_path>
# 输出 JSON：{"ok":true,"mix_id":"...","videos":[{"aweme_id","desc"}...]}
import sys, json, asyncio, os

def fail(msg):
    try:
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            json.dump({"ok": False, "error": msg}, f, ensure_ascii=False)
    except Exception:
        pass
    os._exit(0)

try:
    from f2.log.logger import logger
    logger.remove()  # 静音 f2 的 INFO/Bark 噪声
except Exception:
    pass

from f2.apps.douyin.handler import DouyinHandler
from f2.apps.douyin.utils import TokenManager

MIX_ID = sys.argv[1]
OUT = sys.argv[2]
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


async def main():
    ttwid = TokenManager.gen_ttwid()
    msToken = TokenManager.gen_real_msToken()
    kwargs = {
        "headers": {"User-Agent": UA, "Referer": "https://www.douyin.com/"},
        "cookie": f"ttwid={ttwid}; msToken={msToken}",
        "proxies": {"http://": None, "https://": None},
        "timeout": 20,
        "mode": "mix",
    }
    h = DouyinHandler(kwargs)
    videos = []
    async for page in h.fetch_user_mix_videos(MIX_ID, page_counts=20):
        d = page._to_dict()
        ids = d.get("aweme_id") or []
        descs = d.get("desc") or []
        if not isinstance(ids, list):
            ids, descs = [ids], [descs]
        for aid, desc in zip(ids, descs):
            if aid:
                videos.append({"aweme_id": str(aid), "desc": str(desc)})
        if len(videos) >= 200:
            break
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"ok": True, "mix_id": MIX_ID, "videos": videos}, f, ensure_ascii=False)


try:
    asyncio.run(main())
except Exception as e:
    fail(str(e)[:200])
os._exit(0)
