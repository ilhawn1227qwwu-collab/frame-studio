"""One-shot public TikTok/Instagram metadata check on the actual Render IP.

Opt-in with FRAME_SOCIAL_PROBE=1. Only fixed, publicly documented samples,
no authentication, file downloads or user URLs. Outputs no signed media URLs.
"""
import json
import time
from social import inspect, SocialError

CASES = (
    ("tiktok_video", "https://www.tiktok.com/@matatogames/video/7179163174057364742"),
    ("instagram_photo", "https://www.instagram.com/p/DCkNonioVx2/"),
    ("instagram_reel", "https://www.instagram.com/reel/DZntaBKS0AR/"),
)

for label,url in CASES:
    start=time.monotonic()
    try:
        result=inspect(url)
        print("FRAME_SOCIAL: " + json.dumps({
            "case":label, "result":"ok", "content_type":result.get("content_type"),
            "provider":result.get("provider"),"photos":result.get("photo_count"),
            "qualities":result.get("qualities"),
            "seconds":round(time.monotonic()-start,2)
        }),flush=True)
    except SocialError as exc:
        print("FRAME_SOCIAL: " + json.dumps({
            "case":label,"result":"restricted",
            "error":"photo/video login check or server access restriction",
            "seconds":round(time.monotonic()-start,2)
        }),flush=True)
    except Exception as exc:
        print("FRAME_SOCIAL: " + json.dumps({
            "case":label,"result":"unexpected","type":type(exc).__name__
        }),flush=True)
print("FRAME_SOCIAL: finished",flush=True)
