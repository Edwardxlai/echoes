# -*- coding: utf-8 -*-
# 抖音合集(mix)工具，用 f2 自造的游客 cookie（无需登录）。两种模式：
#   枚举合集：python mix_enum.py <mix_id> <out_json_path>
#     → {"ok":true,"mix_id":"...","videos":[{"aweme_id","desc"}...]}
#   单集反查所属合集：python mix_enum.py --detail <aweme_id> <out_json_path>
#     → {"ok":true,"mix_id":"...或null","mix_name":"..."}
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

DETAIL = sys.argv[1] == "--detail"
TARGET_ID = sys.argv[2] if DETAIL else sys.argv[1]
OUT = sys.argv[3] if DETAIL else sys.argv[2]
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def make_handler(mode):
    ttwid = TokenManager.gen_ttwid()
    msToken = TokenManager.gen_real_msToken()
    kwargs = {
        "headers": {"User-Agent": UA, "Referer": "https://www.douyin.com/"},
        "cookie": f"ttwid={ttwid}; msToken={msToken}",
        "proxies": {"http://": None, "https://": None},
        "timeout": 20,
        "mode": mode,
    }
    return DouyinHandler(kwargs)


async def detail():
    v = await make_handler("one").fetch_one_video(TARGET_ID)
    d = v._to_dict()
    mix_id = d.get("mix_id")
    mix_id = str(mix_id) if mix_id and str(mix_id) not in ("None", "0") else None
    mix_name = str(d.get("mix_name") or "") if mix_id else ""
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"ok": True, "mix_id": mix_id, "mix_name": mix_name}, f, ensure_ascii=False)


async def main():
    h = make_handler("mix")
    videos = []
    async for page in h.fetch_user_mix_videos(TARGET_ID, page_counts=20):
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
        json.dump({"ok": True, "mix_id": TARGET_ID, "videos": videos}, f, ensure_ascii=False)


try:
    asyncio.run(detail() if DETAIL else main())
except Exception as e:
    fail(str(e)[:200])
os._exit(0)
