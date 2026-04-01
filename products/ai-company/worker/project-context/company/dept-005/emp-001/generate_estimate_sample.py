#!/usr/bin/env python3
"""
見積書PDF生成 - サンプル会社 HP制作
"""
import sys, os
sys.path.insert(0, os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))

from fpdf import FPDF
from datetime import datetime, timedelta
import math

# ============================================================
# パラメータ
# ============================================================
PARAMS = {
    # 見積先
    "client_name": "サンプル会社",
    "client_honorific": "御中",
    "client_person": "",
    "client_zip": "",
    "client_address": "",

    # 見積情報
    "estimate_date": "2026-03-30",
    "estimate_number": "Q-0000000004",
    "valid_until": "2026-04-30",
    "subject": "ホームページ制作",

    # 明細 [摘要, 数量, 単価]
    "items": [
        ["ホームページ制作一式", 1, 100000],
    ],

    # 納品情報
    "delivery_deadline": "",
    "delivery_location": "チャットツール（LINE）上",

    # 備考
    "notes": "ドメイン取得費、ドメイン維持費、サーバー維持費、その他運用に伴い発生する費用につきましては、すべてお客様のご負担となります。",

    # 出力先
    "output_path": os.path.join(os.path.dirname(__file__), "見積書_サンプル会社_20260330.pdf"),
}

# ============================================================
# 自社情報
# ============================================================
COMPANY = {
    "name": "NetRunners",
    "person": "竹内大登",
    "zip": "343-0011",
    "address": "埼玉県越谷市増林3500",
    "tel": "090-2914-7413",
    "email": "netrunners.business@gmail.com",
}


class EstimatePDF(FPDF):
    def __init__(self):
        super().__init__("P", "mm", "A4")
        self.add_font("gothic", "", "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf")
        self.add_font("gothic_bold", "", "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf")
        self.set_auto_page_break(auto=True, margin=15)

    def footer(self):
        self.set_y(-15)
        self.set_font("gothic", size=8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"{self.page_no()} / {{nb}}", align="C")


def generate_estimate(p=PARAMS):
    pdf = EstimatePDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    # --- タイトル ---
    pdf.set_font("gothic_bold", size=22)
    pdf.cell(0, 14, "見積書", align="C", new_x="LEFT", new_y="NEXT")
    pdf.ln(8)

    y_top = pdf.get_y()

    # --- 見積先（左上）---
    pdf.set_font("gothic_bold", size=14)
    pdf.cell(100, 8, f'{p["client_name"]} {p["client_honorific"]}', new_x="LEFT", new_y="NEXT")
    pdf.set_font("gothic", size=10)
    if p.get("client_person"):
        pdf.cell(100, 6, p["client_person"], new_x="LEFT", new_y="NEXT")
    if p.get("client_zip"):
        pdf.cell(100, 6, p["client_zip"], new_x="LEFT", new_y="NEXT")
    if p.get("client_address"):
        pdf.cell(100, 6, p["client_address"], new_x="LEFT", new_y="NEXT")

    # --- 右上メタ ---
    pdf.set_xy(120, y_top)
    pdf.set_font("gothic", size=9)
    meta = [
        ("見積日", p["estimate_date"]),
        ("見積書番号", p["estimate_number"]),
        ("有効期限", p["valid_until"]),
    ]
    for label, val in meta:
        y = pdf.get_y()
        pdf.set_xy(120, y)
        pdf.cell(30, 6, label, new_x="RIGHT")
        pdf.cell(50, 6, val, align="R", new_x="LEFT", new_y="NEXT")

    # --- 自社情報 ---
    pdf.ln(8)
    pdf.set_x(110)
    pdf.set_font("gothic_bold", size=13)
    pdf.cell(80, 8, COMPANY["name"], align="R", new_x="LEFT", new_y="NEXT")
    pdf.set_font("gothic", size=10)
    for line in [
        COMPANY["person"],
        f'住所:〒{COMPANY["zip"]}',
        f'　　  {COMPANY["address"]}',
        f'TEL:{COMPANY["tel"]}',
        f'Mail:{COMPANY["email"]}',
    ]:
        pdf.set_x(110)
        pdf.cell(80, 5.5, line, align="R", new_x="LEFT", new_y="NEXT")

    # --- 件名 ---
    pdf.ln(6)
    pdf.set_font("gothic_bold", size=11)
    pdf.cell(15, 8, "件名", new_x="RIGHT")
    pdf.set_font("gothic", size=11)
    pdf.cell(100, 8, p["subject"], new_x="LEFT", new_y="NEXT")

    # --- 金額計算 ---
    subtotal = sum(item[1] * item[2] for item in p["items"])
    tax = math.floor(subtotal * 0.1)
    total = subtotal + tax

    # --- サマリー ---
    pdf.ln(3)
    pdf.set_font("gothic", size=8)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_x(10)
    pdf.cell(45, 6, "小計", border=1, fill=True, align="C")
    pdf.cell(45, 6, "消費税", border=1, fill=True, align="C")
    pdf.cell(60, 6, "見積金額", border=1, fill=True, align="C")
    pdf.ln()

    pdf.set_x(10)
    pdf.set_font("gothic", size=10)
    pdf.cell(45, 10, f'{subtotal:,}円', border=1, align="C")
    pdf.cell(45, 10, f'{tax:,}円', border=1, align="C")
    pdf.set_font("gothic_bold", size=16)
    pdf.set_text_color(220, 50, 50)
    pdf.cell(60, 10, f'{total:,}円', border=1, align="C")
    pdf.set_text_color(0, 0, 0)
    pdf.ln()

    # --- 明細テーブル ---
    pdf.ln(4)
    pdf.set_font("gothic", size=8)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_x(10)
    col_w = [80, 25, 35, 40]
    headers = ["摘要", "数量", "単価", "明細金額"]
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 7, h, border=1, fill=True, align="C")
    pdf.ln()

    pdf.set_font("gothic", size=10)
    for item in p["items"]:
        pdf.set_x(10)
        pdf.cell(col_w[0], 8, item[0], border=1)
        pdf.cell(col_w[1], 8, str(item[1]), border=1, align="C")
        pdf.cell(col_w[2], 8, f'{item[2]:,}', border=1, align="R")
        pdf.cell(col_w[3], 8, f'{item[1] * item[2]:,}', border=1, align="R")
        pdf.ln()

    for _ in range(max(0, 5 - len(p["items"]))):
        pdf.set_x(10)
        for w in col_w:
            pdf.cell(w, 8, "", border=1)
        pdf.ln()

    # --- 内訳 ---
    pdf.ln(2)
    pdf.set_x(100)
    pdf.set_font("gothic", size=8)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(50, 6, "内訳　10%対象(税抜)", border=1, fill=True)
    pdf.cell(30, 6, f'{subtotal:,}円', border=1, align="R")
    pdf.ln()
    pdf.set_x(100)
    pdf.cell(50, 6, "　　　10%消費税", border=1, fill=True)
    pdf.cell(30, 6, f'{tax:,}円', border=1, align="R")
    pdf.ln()

    # --- 納品期限・場所 ---
    pdf.ln(3)
    pdf.set_font("gothic_bold", size=9)
    pdf.set_x(10)
    pdf.cell(25, 6, "納品期限", new_x="RIGHT")
    pdf.set_font("gothic", size=9)
    pdf.cell(60, 6, p.get("delivery_deadline", ""), new_x="LEFT", new_y="NEXT")
    pdf.set_font("gothic_bold", size=9)
    pdf.set_x(10)
    pdf.cell(25, 6, "納品場所", new_x="RIGHT")
    pdf.set_font("gothic", size=9)
    pdf.cell(100, 6, p.get("delivery_location", ""), new_x="LEFT", new_y="NEXT")

    # --- 備考 ---
    pdf.ln(4)
    pdf.set_x(10)
    pdf.set_font("gothic", size=8)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(170, 6, "備考", border=1, fill=True)
    pdf.ln()
    pdf.set_x(10)
    pdf.set_font("gothic", size=9)
    pdf.multi_cell(170, 6, p.get("notes", ""), border=1)

    # --- 出力 ---
    out = p["output_path"]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pdf.output(out)
    print(f"Generated: {out}")
    return out


if __name__ == "__main__":
    generate_estimate()
