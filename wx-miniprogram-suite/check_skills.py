#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
WorkBuddy 开放平台上传前门禁。

平台的文件质量检测会把 SKILL.md 里出现的 references/ scripts/ templates/ assets/
路径当作「必须随包提供的资源」，包内没有就驳回（内置文件缺失）。本脚本复刻该检查：

  1. frontmatter 用 PyYAML 真实解析，校验必填字段、禁止残留 SkillHub 字段
  2. 抽取 SKILL.md 与 references/*.md 中所有包内路径，逐个确认文件存在
  3. 扫描 `xxx skill` 形式的外部技能引用（平台会当成缺失依赖）
  4. 校验 zips/ 下每个 zip：SKILL.md 在根、文件清单与源目录一致

用法：python check_skills.py          扫描 9 个 skill
      python check_skills.py --zip    同时校验 zips/
退出码 0 = 全绿；1 = 有问题。
"""
import os
import re
import sys
import zipfile

try:
    import yaml
except ImportError:
    print("FATAL: 需要 PyYAML。用系统 Python 3.12 运行：")
    print(r"  C:\Users\86135\AppData\Local\Programs\Python\Python312\python.exe check_skills.py")
    sys.exit(2)

BASE = os.path.dirname(os.path.abspath(__file__))
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
REQUIRED = ['name', 'display_name', 'description', 'description_zh',
            'description_en', 'category', 'version', 'author']
FORBIDDEN = ['slug', 'displayName', 'summary', 'license']

PATH_RE = re.compile(r'(?:^|[\s`(\[<>"\'])((?:references|scripts|templates|assets)/[A-Za-z0-9_.\-/]+)')
SKILL_REF_RE = re.compile(r'`?([a-z0-9][a-z0-9\-]{4,})`?\s+skill\b', re.I)

errors = []
warns = []


def split_front_matter(text):
    lines = text.split('\n')
    if not lines or lines[0].strip() != '---':
        return None, text
    for i in range(1, len(lines)):
        if lines[i].strip() == '---':
            return '\n'.join(lines[1:i]), '\n'.join(lines[i + 1:])
    return None, text


def check_one(skill):
    root = os.path.join(BASE, skill)
    md = os.path.join(root, 'SKILL.md')
    if not os.path.isfile(md):
        errors.append('%s: 缺少 SKILL.md' % skill)
        return
    text = open(md, encoding='utf-8').read()

    # 1. frontmatter
    fm_text, _body = split_front_matter(text)
    if fm_text is None:
        errors.append('%s: 没有合法的 --- frontmatter 包裹' % skill)
        return
    try:
        fm = yaml.safe_load(fm_text)
    except Exception as e:
        errors.append('%s: YAML 解析失败 -> %s' % (skill, e))
        return
    if not isinstance(fm, dict):
        errors.append('%s: frontmatter 不是 mapping' % skill)
        return
    for k in REQUIRED:
        if not fm.get(k):
            errors.append('%s: 缺必填字段 %s' % (skill, k))
    for k in FORBIDDEN:
        if k in fm:
            errors.append('%s: 残留 SkillHub 字段 %s' % (skill, k))
    if fm.get('name') != skill:
        warns.append('%s: name(%s) 与目录名不一致' % (skill, fm.get('name')))

    # 2. 包内路径必须存在（SKILL.md + references 下所有 md）
    scan_files = [md]
    ref_dir = os.path.join(root, 'references')
    if os.path.isdir(ref_dir):
        for f in sorted(os.listdir(ref_dir)):
            if f.lower().endswith('.md'):
                scan_files.append(os.path.join(ref_dir, f))
    for f in scan_files:
        body = open(f, encoding='utf-8').read()
        if f == md:
            body = _body
        for lineno, line in enumerate(body.split('\n'), 1):
            for m in PATH_RE.finditer(line):
                p = m.group(1).rstrip('.,;:、，。`）)]')
                if not p or p.endswith('/'):
                    continue
                target = os.path.join(root, p.replace('/', os.sep))
                if not os.path.exists(target):
                    src = 'SKILL.md' if f == md else 'references/' + os.path.basename(f)
                    errors.append('%s: %s 引用 %s 但包内不存在' % (skill, src, p))

    # 3. 外部技能引用（平台会判为缺失依赖）
    for lineno, line in enumerate(_body.split('\n'), 1):
        for m in SKILL_REF_RE.finditer(line):
            ref = m.group(1)
            if ref.lower() in ('this', 'the', 'a', 'that', 'same', 'other'):
                continue
            warns.append('%s: SKILL.md:%d 出现 "`%s` skill" 形态的外部技能引用，平台可能判为缺失依赖' % (skill, lineno, ref))


def check_zip(skill):
    zp = os.path.join(BASE, 'zips', skill + '.zip')
    if not os.path.isfile(zp):
        errors.append('%s: zips 下缺 %s.zip' % (skill, skill))
        return
    try:
        with zipfile.ZipFile(zp) as z:
            bad = z.testzip()
            if bad:
                errors.append('%s.zip: 损坏条目 %s' % (skill, bad))
                return
            names = [n for n in z.namelist() if not n.endswith('/')]
    except Exception as e:
        errors.append('%s.zip: 打开失败 %s' % (skill, e))
        return
    if 'SKILL.md' not in names:
        errors.append('%s.zip: SKILL.md 不在根目录（当前顶层：%s）'
                      % (skill, sorted({n.split('/')[0] for n in names})[:3]))
    src_root = os.path.join(BASE, skill)
    want = set()
    for dirpath, _dirnames, filenames in os.walk(src_root):
        for fn in filenames:
            rel = os.path.relpath(os.path.join(dirpath, fn), src_root).replace(os.sep, '/')
            want.add(rel)
    got = set(names)
    for miss in sorted(want - got):
        errors.append('%s.zip: 少了源目录里的 %s（zip 未重新生成？）' % (skill, miss))
    if got - want:
        warns.append('%s.zip: 多出源目录没有的 %s' % (skill, sorted(got - want)[:5]))


for s in SKILLS:
    if '--selftest' in sys.argv:
        # 反向测试：确认正则真能抓到「缺文件」与「外部技能引用」
        assert PATH_RE.search('see `references/not-exist.md` ok'), 'PATH_RE 未命中 references/'
        assert PATH_RE.search('run `node scripts/audit-redlines.js <root>`'), 'PATH_RE 未命中 scripts/'
        assert PATH_RE.search('copy `assets/vp.js` into'), 'PATH_RE 未命中 assets/'
        assert SKILL_REF_RE.search('is the `miniprogram-redline-audit` skill'), 'SKILL_REF_RE 未命中 X skill'
        assert not SKILL_REF_RE.search('走 `miniprogram-docx` 导出'), 'SKILL_REF_RE 误伤普通引用'
        # 端到端反向测试：造一个引用不存在文件的 skill，必须报错
        tmp = os.path.join(BASE, '_selftest_skill')
        os.makedirs(tmp, exist_ok=True)
        with open(os.path.join(tmp, 'SKILL.md'), 'w', encoding='utf-8') as fh:
            fh.write('---\nname: _selftest_skill\ndisplay_name: t\ndescription: t\n'
                     'description_zh: t\ndescription_en: t\ncategory: t\nversion: 0.0.1\nauthor: t\n---\n'
                     'Load `references/ghost.md`.\n')
        before = len(errors)
        check_one('_selftest_skill')
        assert len(errors) > before, '缺文件未报错'
        assert any('ghost.md' in e for e in errors), '报错信息未包含缺失文件名'
        for fn in os.listdir(tmp):
            os.remove(os.path.join(tmp, fn))
        os.rmdir(tmp)
        print('SELFTEST PASS')
        sys.exit(0)

    check_one(s)
if '--zip' in sys.argv:
    for s in SKILLS:
        check_zip(s)

for w in warns:
    print('WARN  ' + w)
for e in errors:
    print('ERROR ' + e)
print('-' * 60)
print('skills=%d  errors=%d  warns=%d' % (len(SKILLS), len(errors), len(warns)))
sys.exit(1 if errors else 0)
