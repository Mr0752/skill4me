#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""重新生成 zips/<skill>.zip（SKILL.md 在包根目录，正斜杠路径，UTF-8 文件名）。

用法：python make_zips.py
生成后请跑：python check_skills.py --zip
"""
import os
import zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
ZIP_DIR = os.path.join(BASE, 'zips')
SKILLS = [
    'wx-miniprogram-scaffold',
    'wx-miniprogram-blueprint',
    'wx-virtual-payment',
    'miniprogram-redline-audit',
    'miniprogram-guardrails',
    'miniprogram-docx',
    'cloudbase-ai-textgen',
    'doc-scan-ocr',
    'wx-miniprogram-publish',
]

os.makedirs(ZIP_DIR, exist_ok=True)
for s in SKILLS:
    src = os.path.join(BASE, s)
    if not os.path.isdir(src):
        raise SystemExit('缺少源目录：%s' % src)
    dst = os.path.join(ZIP_DIR, s + '.zip')
    if os.path.exists(dst):
        os.remove(dst)
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        for dirpath, dirnames, filenames in os.walk(src):
            dirnames.sort()
            for fn in sorted(filenames):
                full = os.path.join(dirpath, fn)
                arc = os.path.relpath(full, src).replace(os.sep, '/')
                z.write(full, arc)
    print('%-28s %7d bytes' % (s + '.zip', os.path.getsize(dst)))
print('DONE: %d zips' % len(SKILLS))
