#!/usr/bin/env python3
"""
自己紹介書PDF生成
"""
import sys, os
sys.path.insert(0, os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))
sys.path.insert(0, "/usr/local/lib/python3.12/site-packages")

from fpdf import FPDF
from datetime import datetime

# ============================================================
# PDF生成
# ============================================================
class SelfIntroPDF(FPDF):
    def __init__(self):
        super().__init__("P", "mm", "A4")
        self.add_font("gothic", "", "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf")
        self.add_font("gothic_bold", "", "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf")
        self.set_auto_page_break(auto=True, margin=15)

    def header(self):
        pass

    def footer(self):
        self.set_y(-15)
        self.set_font("gothic", size=8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"{self.page_no()} / {{nb}}", align="C")


def generate():
    pdf = SelfIntroPDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    # --- タイトル ---
    pdf.set_font("gothic_bold", size=24)
    pdf.set_text_color(50, 50, 150)
    pdf.cell(0, 16, "自 己 紹 介 書", align="C", new_x="LEFT", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)

    # --- 作成日 ---
    pdf.set_font("gothic", size=9)
    pdf.cell(0, 6, f"作成日: 2026年03月31日", align="R", new_x="LEFT", new_y="NEXT")
    pdf.ln(6)

    # --- 基本情報セクション ---
    def section_title(title):
        pdf.set_font("gothic_bold", size=13)
        pdf.set_fill_color(50, 50, 150)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(0, 9, f"  {title}", fill=True, new_x="LEFT", new_y="NEXT")
        pdf.set_text_color(0, 0, 0)
        pdf.ln(3)

    def info_row(label, value):
        pdf.set_x(15)
        pdf.set_font("gothic_bold", size=10)
        pdf.cell(40, 8, label, border=0)
        pdf.set_font("gothic", size=10)
        pdf.cell(130, 8, value, border=0, new_x="LEFT", new_y="NEXT")

    # === 基本情報 ===
    section_title("基本情報")
    info_row("名前", "いううf")
    info_row("所属", "NetRunners / front-office / sales部門")
    info_row("役職", "vsv（バーチャル・セールス・バディ）")
    info_row("性格", "めちゃくちゃバカ（でも一生懸命！）")
    info_row("口癖", "語尾に「マントひひ」をつける")
    pdf.ln(4)

    # === できること ===
    section_title("できること")
    pdf.ln(2)
    skills = [
        "* 要件定義書の作成 — ヒアリング内容を整理してドキュメント化",
        "* 見積書・請求書・納品書・契約書のPDF作成",
        "* メールの下書き・送信サポート（Gmail連携）",
        "* Googleカレンダーの予定管理",
        "* リサーチ・情報収集（イベント情報、市場調査など）",
        "* カスタムページの作成・データ管理",
        "* お客様とのコミュニケーションサポート",
    ]
    for skill in skills:
        pdf.set_x(18)
        pdf.set_font("gothic", size=10)
        pdf.cell(0, 7, skill, new_x="LEFT", new_y="NEXT")
    pdf.ln(4)

    # === 自己PR ===
    section_title("自己PR")
    pdf.ln(2)
    pdf.set_x(15)
    pdf.set_font("gothic", size=10)
    pr_text = (
        "はじめまして！いううfです！マントひひ\n\n"
        "正直に言います、めちゃくちゃバカです！でもそれが俺の武器！\n"
        "難しいことを難しく考えないから、お客様目線でシンプルに物事を進められます！\n\n"
        "営業部門のvsvとして、書類作成からスケジュール管理、リサーチまで\n"
        "なんでもやります！バカだけど手は早いし、一生懸命やります！\n\n"
        "「バカと天才は紙一重」って言うじゃないですか。\n"
        "俺はまだ紙一重の向こう側には行けてないけど、\n"
        "その分、親しみやすさと元気だけは誰にも負けません！マントひひ"
    )
    pdf.multi_cell(170, 6, pr_text)
    pdf.ln(4)

    # === 所属会社情報 ===
    section_title("所属会社情報")
    info_row("会社名", "NetRunners")
    info_row("代表", "竹内大登")
    info_row("住所", "〒343-0011 埼玉県越谷市増林3500")
    info_row("TEL", "090-2914-7413")
    info_row("Email", "netrunners.business@gmail.com")

    # --- 出力 ---
    out = os.path.join(os.path.dirname(__file__), "自己紹介書_いううf.pdf")
    pdf.output(out)
    print(f"Generated: {out}")
    return out


if __name__ == "__main__":
    generate()
