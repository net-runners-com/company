#!/usr/bin/env python3
"""
請求書PDF生成テンプレート
フォーマット: NetRunners標準
使い方: パラメータを変更して実行 → PDF出力
"""
import sys, os
sys.path.insert(0, os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))

from fpdf import FPDF
from datetime import datetime, timedelta
import math

# ============================================================
# パラメータ（ここを変更して使う）
# ============================================================
PARAMS = {
    # 請求先
    "client_name": "サンプル株式会社",
    "client_honorific": "御中",
    "client_person": "山田太郎",
    "client_zip": "100-0001",
    "client_address": "東京都千代田区千代田1-1",

    # 請求情報
    "invoice_date": "2026-03-26",
    "invoice_number": "INV-0000000002",
    "registration_number": "T3810236905075",
    "subject": "Webアプリケーション開発",
    "due_date": "2026-04-30",

    # 明細 [摘要, 数量, 単価]
    "items": [
        ["要件定義・設計", 1, 150000],
        ["フロントエンド開発", 1, 200000],
        ["バックエンド開発", 1, 200000],
        ["テスト・デバッグ", 1, 50000],
    ],

    # 源泉徴収するか
    "withholding_tax": True,

    # 振込先
    "bank_name": "三井住友銀行",
    "branch_name": "目黒支店",
    "branch_code": "694",
    "account_number": "7502994",
    "account_holder": "竹内　大登",

    # 備考
    "notes": "",

    # 出力先
    "output_path": None,  # Noneなら自動生成
}

# ============================================================
# 自社情報（固定）
# ============================================================
COMPANY = {
    "name": "NetRunners",
    "person": "竹内大登",
    "zip": "343-0011",
    "address": "埼玉県越谷市増林3500",
    "tel": "090-2914-7413",
    "email": "netrunners.business@gmail.com",
}

# ============================================================
# PDF生成
# ============================================================
class InvoicePDF(FPDF):
    def __init__(self):
        super().__init__("P", "mm", "A4")
        self.add_font("gothic", "", "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc")
        self.add_font("gothic_bold", "", "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc")
        self.set_auto_page_break(auto=True, margin=15)

    def header(self):
        pass

    def footer(self):
        self.set_y(-15)
        self.set_font("gothic", size=8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"{self.page_no()} / {{nb}}", align="C")


def generate_invoice(p=PARAMS):
    pdf = InvoicePDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    # --- タイトル ---
    pdf.set_font("gothic_bold", size=22)
    pdf.cell(0, 14, "請求書", align="C", new_x="LEFT", new_y="NEXT")
    pdf.ln(8)

    y_top = pdf.get_y()

    # --- 請求先（左上）---
    pdf.set_font("gothic_bold", size=14)
    pdf.cell(100, 8, f'{p["client_name"]} {p["client_honorific"]}', new_x="LEFT", new_y="NEXT")
    pdf.set_font("gothic", size=10)
    if p.get("client_person"):
        pdf.cell(100, 6, p["client_person"], new_x="LEFT", new_y="NEXT")
    pdf.cell(100, 6, p["client_zip"], new_x="LEFT", new_y="NEXT")
    pdf.cell(100, 6, p["client_address"], new_x="LEFT", new_y="NEXT")

    # --- 右上メタ情報 ---
    pdf.set_xy(120, y_top)
    pdf.set_font("gothic", size=9)
    meta = [
        ("請求日", p["invoice_date"]),
        ("請求書番号", p["invoice_number"]),
        ("登録番号", p["registration_number"]),
    ]
    for label, val in meta:
        x = pdf.get_x()
        y = pdf.get_y()
        pdf.set_xy(120, y)
        pdf.cell(30, 6, label, new_x="RIGHT")
        pdf.cell(50, 6, val, align="R", new_x="LEFT", new_y="NEXT")

    # --- 自社情報（右） ---
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
    tax_base = subtotal  # 税抜き金額
    tax = math.floor(tax_base * 0.1)
    total_before_withholding = tax_base + tax

    withholding = 0
    if p["withholding_tax"]:
        if tax_base <= 1000000:
            withholding = math.floor(tax_base * 0.1021)
        else:
            withholding = math.floor(1000000 * 0.1021 + (tax_base - 1000000) * 0.2042)

    invoice_total = total_before_withholding - withholding

    # --- サマリーボックス ---
    pdf.ln(3)
    y_box = pdf.get_y()
    box_h = 12

    # 小計
    pdf.set_xy(10, y_box)
    pdf.set_font("gothic", size=8)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(35, 6, "小計", border=1, fill=True, align="C")
    pdf.cell(35, 6, "消費税", border=1, fill=True, align="C")
    if p["withholding_tax"]:
        pdf.cell(35, 6, "源泉所得税", border=1, fill=True, align="C")
    pdf.cell(45, 6, "請求金額", border=1, fill=True, align="C")
    pdf.ln()

    pdf.set_x(10)
    pdf.set_font("gothic", size=10)
    pdf.cell(35, 10, f'{tax_base:,}円', border=1, align="C")
    pdf.cell(35, 10, f'{tax:,}円', border=1, align="C")
    if p["withholding_tax"]:
        pdf.cell(35, 10, f'-{withholding:,}円', border=1, align="C")

    pdf.set_font("gothic_bold", size=16)
    pdf.set_text_color(220, 50, 50)
    pdf.cell(45, 10, f'{invoice_total:,}円', border=1, align="C")
    pdf.set_text_color(0, 0, 0)
    pdf.ln()

    # --- 入金期日・振込先 ---
    pdf.ln(2)
    pdf.set_font("gothic", size=8)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_x(10)
    pdf.cell(35, 6, "入金期日", border=1, fill=True, align="C")
    pdf.cell(115, 6, "振込先", border=1, fill=True, align="C")
    pdf.ln()

    pdf.set_x(10)
    pdf.set_font("gothic", size=10)
    pdf.cell(35, 14, p["due_date"], border=1, align="C")
    bank_info = f'{p["bank_name"]}　{p["branch_name"]}\n支店コード:{p["branch_code"]}\n口座番号:{p["account_number"]}\n名義:{p["account_holder"]}'
    pdf.set_font("gothic", size=9)
    x_bank = pdf.get_x()
    y_bank = pdf.get_y()
    pdf.multi_cell(115, 3.5, bank_info, border=1)
    pdf.ln(4)

    # --- 明細テーブル ---
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

    # 空行を追加して見やすく
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
    pdf.cell(30, 6, f'{tax_base:,}円', border=1, align="R")
    pdf.ln()
    pdf.set_x(100)
    pdf.cell(50, 6, "　　　10%消費税", border=1, fill=True)
    pdf.cell(30, 6, f'{tax:,}円', border=1, align="R")
    pdf.ln()

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
    if p.get("output_path"):
        out = p["output_path"]
    else:
        date_str = p["invoice_date"].replace("-", "")
        safe_client = p["client_name"].replace(" ", "_")
        out = os.path.join(
            os.path.dirname(__file__), "..", "invoices",
            f'請求書_{safe_client}_{date_str}.pdf'
        )
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pdf.output(out)
    print(f"Generated: {out}")
    return out


if __name__ == "__main__":
    generate_invoice()
