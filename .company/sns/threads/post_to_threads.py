#!/usr/bin/env python3
"""Threads 自動投稿スクリプト（browser-use CLI使用）"""

import os
import sys
import re
import json
import base64
import subprocess
import time
from pathlib import Path

BROWSER_USE = os.path.expanduser("~/.browser-use-env/bin/browser-use")
CHROME_PROFILE = "Profile 1"


def set_profile(profile: str):
    global CHROME_PROFILE
    CHROME_PROFILE = profile


def run(cmd: str, check: bool = True) -> str:
    full_cmd = f'{BROWSER_USE} --headed --profile "{CHROME_PROFILE}" {cmd}'
    result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=30)
    return result.stdout.strip()


def wait(seconds: float):
    time.sleep(seconds)


def get_state() -> str:
    return run("state", check=False)


def find_index(state: str, keyword: str) -> str:
    lines = state.split("\n")
    for i, line in enumerate(lines):
        if keyword in line:
            match = re.search(r'\[(\d+)\]', line)
            if match:
                return match.group(1)
            if i > 0:
                match = re.search(r'\[(\d+)\]', lines[i - 1])
                if match:
                    return match.group(1)
    return ""


def post_to_threads(text: str, topic: str = ""):
    """Threadsに投稿する"""
    print(f"\n{'='*50}")
    print(f"Threads投稿: {CHROME_PROFILE}")
    print(f"文字数: {len(text)}")
    if topic:
        print(f"トピック: {topic}")
    print(f"{'='*50}")

    # === Step 1: Threadsを開く ===
    print("\n=== Step 1: Open Threads ===")
    run("open https://www.threads.net")
    wait(5)

    state = get_state()
    print(f"  Page loaded: {'Threads' in state or 'threads' in state.lower()}")

    # === Step 2: 新規投稿ダイアログを開く ===
    print("\n=== Step 2: Open new post dialog ===")

    post_idx = ""
    for kw in ["新規スレッド", "新しいスレッド", "Create", "作成", "投稿を作成"]:
        post_idx = find_index(state, kw)
        if post_idx:
            break

    if post_idx:
        run(f"click {post_idx}")
        wait(2)
        print(f"  投稿ダイアログを開きました (index {post_idx})")
    else:
        result = run('eval "const btn=document.querySelector(\'[aria-label*=\\\"新規\\\"]\')||document.querySelector(\'[aria-label*=\\\"Create\\\"]\')||document.querySelector(\'[aria-label*=\\\"作成\\\"]\')||document.querySelector(\'a[href*=\\\"/create\\\"]\');if(btn){btn.click();\'clicked\';}else{\'not found\';}"')
        wait(2)
        print(f"  JS fallback 新規投稿: {result}")

    # === Step 2.5: トピック設定 ===
    if topic:
        print(f"\n=== Step 2.5: Set topic: {topic} ===")

        # 「トピックを追加」をクリック
        state_topic = get_state()
        topic_idx = find_index(state_topic, "トピックを追加")
        if topic_idx:
            run(f"click {topic_idx}")
            wait(1)
            print(f"  トピック入力欄を開きました (index {topic_idx})")
        else:
            result = run('eval "const btn=Array.from(document.querySelectorAll(\'[role=button],span,div\')).find(b=>b.textContent.includes(\'トピックを追加\'));if(btn){btn.click();\'clicked\';}else{\'not found\';}"')
            wait(1)
            print(f"  JS fallback トピック欄: {result}")

        # トピックテキストを入力
        wait(0.5)
        topic_b64 = base64.b64encode(topic.encode("utf-8")).decode("ascii")
        js_topic = (
            f"(function(){{"
            f"const b='{topic_b64}';"
            f"const bytes=Uint8Array.from(atob(b),c=>c.charCodeAt(0));"
            f"const txt=new TextDecoder().decode(bytes);"
            f"const inputs=document.querySelectorAll('input[type=text],input:not([type])');"
            f"const topicInput=Array.from(inputs).find(i=>i.placeholder&&(i.placeholder.includes('トピック')||i.placeholder.includes('topic')));"
            f"if(topicInput){{topicInput.focus();topicInput.value=txt;topicInput.dispatchEvent(new Event('input',{{bubbles:true}}));'set';}}"
            f"else{{"
            # contenteditable の場合もある
            f"const ce=document.querySelectorAll('[contenteditable=true]');"
            f"if(ce.length>1){{ce[0].focus();document.execCommand('insertText',false,txt);'inserted';}}"
            f"else{{'not found';}}"
            f"}}}})();"
        )
        result = run(f'eval "{js_topic}"')
        wait(1.5)
        print(f"  トピック入力: {result}")

        # サジェストから最初の候補をクリック
        wait(1)
        js_suggest = (
            "const items=document.querySelectorAll('[role=option],[role=listbox] div,[role=menuitem]');"
            "if(items.length>0){items[0].click();'selected: '+items[0].textContent.trim().slice(0,20);}"
            "else{"
            # サジェストリストが別の構造の場合
            "const divs=Array.from(document.querySelectorAll('div[role=button],div[tabindex]'));"
            "const suggest=divs.find(d=>d.textContent.trim().length>0&&d.textContent.trim().length<30&&d.getBoundingClientRect().y>200);"
            "if(suggest){suggest.click();'selected: '+suggest.textContent.trim().slice(0,20);}"
            "else{'no suggestion found';}"
            "}"
        )
        result = run(f'eval "{js_suggest}"')
        wait(1)
        print(f"  トピック選択: {result}")

    # === Step 3: テキスト入力 ===
    print("\n=== Step 3: Input text ===")
    wait(1)

    b64 = base64.b64encode(text.encode("utf-8")).decode("ascii")

    js = (
        f"(function(){{"
        f"const b='{b64}';"
        f"const bytes=Uint8Array.from(atob(b),c=>c.charCodeAt(0));"
        f"const txt=new TextDecoder().decode(bytes);"
        f"const el=document.querySelector('[contenteditable=true]')"
        f"||document.querySelector('[role=textbox]')"
        f"||document.querySelector('textarea');"
        f"if(el){{"
        f"el.focus();"
        f"document.execCommand('insertText',false,txt);"
        f"'inserted '+txt.length;"
        f"}}else{{'editor not found';}}"
        f"}})();"
    )
    result = run(f'eval "{js}"')
    wait(1)
    print(f"  テキスト入力: {result}")

    # === Step 4: 投稿 ===
    print("\n=== Step 4: Post ===")

    # ダイアログ内の「投稿」ボタンを座標クリックで押す
    # 複数ある場合、Y座標が最も下にあるもの（ダイアログ内のボタン）を選ぶ
    js_find = (
        "const btns=Array.from(document.querySelectorAll('[role=button]'));"
        "const posts=btns.filter(b=>b.textContent.trim()==='投稿');"
        "let best=null;let maxY=0;"
        "posts.forEach(b=>{const r=b.getBoundingClientRect();if(r.y>maxY&&r.width>0){maxY=r.y;best=r;}});"
        "if(best){JSON.stringify({x:Math.round(best.x+best.width/2),y:Math.round(best.y+best.height/2)});}else{'not found';}"
    )
    coords = run(f'eval "{js_find}"')
    print(f"  投稿ボタン座標: {coords}")

    if "not found" not in coords and "{" in coords:
        json_str = coords.split("result: ")[-1] if "result:" in coords else coords
        try:
            pos = json.loads(json_str)
            run(f"click {pos['x']} {pos['y']}")
            wait(4)
            check = run('eval "document.querySelector(\'[contenteditable=true]\')?.innerText?.slice(0,10)||\'gone\'"', check=False)
            if "gone" in check or len(check.strip()) < 15:
                print("  ✅ 投稿しました")
            else:
                print(f"  ⚠ 投稿ボタンが反応しなかった可能性あり: {check[:50]}")
        except Exception as e:
            print(f"  ⚠ 座標パースエラー: {e}")
    else:
        print(f"  ⚠ 投稿ボタンが見つかりません: {coords}")

    # ブラウザを閉じる（browser-useセッションのみ。Chrome自体は閉じない）
    run("close")
    print("\n✅ Threads投稿完了")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: post_to_threads.py <text or file> [--profile 'Profile 3']")
        sys.exit(1)

    text_or_file = sys.argv[1]
    remaining = sys.argv[2:]
    topic = ""
    i = 0
    while i < len(remaining):
        if remaining[i] == "--profile" and i + 1 < len(remaining):
            set_profile(remaining[i + 1])
            i += 2
        elif remaining[i] == "--topic" and i + 1 < len(remaining):
            topic = remaining[i + 1]
            i += 2
        else:
            i += 1

    if Path(text_or_file).exists():
        text = Path(text_or_file).read_text(encoding="utf-8")
    else:
        text = text_or_file

    print(f"  Chrome Profile: {CHROME_PROFILE}")
    post_to_threads(text, topic=topic)
