#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM 对比网站构建脚本：合并 data/*.json + template.html + app.js → index.html
用法：python build.py
"""
import json, os, sys, html

BASE = os.path.dirname(os.path.abspath(__file__))

def load_json(p):
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)

def main():
    meta = load_json(os.path.join(BASE, 'data', 'meta.json'))
    models = []
    for f in sorted(os.listdir(os.path.join(BASE, 'data'))):
        if f.startswith('models_part') and f.endswith('.json'):
            models.extend(load_json(os.path.join(BASE, 'data', f)))
    tools = load_json(os.path.join(BASE, 'data', 'tools.json'))

    # 校验工具引用
    model_ids = {m['id'] for m in models}
    for t in tools:
        for mid in t.get('builtinModels', []):
            if mid not in model_ids:
                print(f'[WARN] tool {t["id"]} 引用了不存在的模型: {mid}')
    for m in models:
        for tid in m.get('tools', []):
            if tid not in {t['id'] for t in tools}:
                print(f'[WARN] model {m["id"]} 引用了不存在的工具: {tid}')

    data = {'meta': meta, 'models': models, 'tools': tools}
    data_json = json.dumps(data, ensure_ascii=False, indent=1)
    # 防止 </script> 截断
    data_json = data_json.replace('</', '<\\/')

    with open(os.path.join(BASE, 'template.html'), 'r', encoding='utf-8') as f:
        tpl = f.read()
    with open(os.path.join(BASE, 'app.js'), 'r', encoding='utf-8') as f:
        app_js = f.read()

    out = tpl
    out = out.replace('__SITE_TITLE__', meta['title'])
    out = out.replace('__UPDATED__', meta['updated'])
    out = out.replace('__DATA_JSON__', data_json)
    out = out.replace('__APP_JS__', app_js)

    out_path = os.path.join(BASE, 'index.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(out)

    print(f'✅ 构建完成: {out_path}')
    print(f'   模型: {len(models)} | 工具: {len(tools)} | 大小: {os.path.getsize(out_path)/1024:.1f} KB')
    print(f'   等级分布: ' + ', '.join(f'{g}={sum(1 for m in models if m["grade"]==g)}' for g in ['S','A','B','C']))

if __name__ == '__main__':
    main()
