#!/usr/bin/env python3
"""
商品売買契約書PDF生成テンプレート
フォーマット: NetRunners標準
"""
import sys, os
sys.path.insert(0, os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))

from fpdf import FPDF
import math

# ============================================================
# パラメータ
# ============================================================
PARAMS = {
    # 買主
    "buyer_name": "サンプル株式会社",
    "buyer_abbreviation": "サンプル(株)",

    # 商品情報
    "product_name": "Webアプリケーション",
    "price_tax_included": 660000,  # 税込

    # 支払条件
    "payment_term": "納品日から30日後",
    "payment_method_detail": "",  # 空なら銀行情報を自動で使う

    # 振込先
    "bank_name": "三井住友銀行",
    "branch_name": "目黒支店",
    "account_type": "普通預金",
    "account_number": "7502994",

    # 引渡し
    "delivery_date": "2026年5月31日",
    "delivery_location": "チャットツール上（LINE）",

    # 違約金
    "penalty_amount": 50000,

    # 契約不適合責任期間
    "defect_period_months": 3,

    # 出力先
    "output_path": None,
}

COMPANY = {
    "name": "NetRunners",
    "person": "竹内大登",
    "address": "埼玉県越谷市増林3500",
}


class ContractPDF(FPDF):
    def __init__(self):
        super().__init__("P", "mm", "A4")
        self.add_font("gothic", "", "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc")
        self.add_font("gothic_bold", "", "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc")
        self.set_auto_page_break(auto=True, margin=20)

    def footer(self):
        self.set_y(-15)
        self.set_font("gothic", size=7)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"書類コード: sample-contract-{PARAMS.get('buyer_name', 'unknown')}", align="C")


def generate_contract(p=PARAMS):
    pdf = ContractPDF()
    pdf.add_page()
    lm = 20  # left margin
    content_w = 170  # content width

    # --- タイトル ---
    pdf.set_font("gothic_bold", size=18)
    pdf.cell(0, 14, "商品売買契約書", align="C", new_x="LEFT", new_y="NEXT")
    pdf.ln(10)

    # --- 前文 ---
    pdf.set_font("gothic", size=10)
    preamble = (
        f'売主：{COMPANY["name"]} （以下「甲」という。）と '
        f'買主：{p["buyer_abbreviation"]} （以下「乙」という。）は、'
        f' 次のとおり売買契約を締結した。'
    )
    pdf.set_x(lm)
    pdf.multi_cell(content_w, 6, preamble)
    pdf.ln(6)

    def add_article(title, body_lines):
        pdf.set_font("gothic_bold", size=10)
        pdf.set_x(lm)
        pdf.cell(content_w, 7, title, new_x="LEFT", new_y="NEXT")
        pdf.set_font("gothic", size=10)
        for line in body_lines:
            pdf.set_x(lm + 2)
            pdf.multi_cell(content_w - 4, 6, line)
        pdf.ln(4)

    # 第1条（売買）
    add_article("（売買）", [
        f'第１条 甲は乙に対し次の商品（以下単に「商品」という。）を売り渡し、乙はこれを買い受ける。',
        f'',
        f'　商品の表示 ： {p["product_name"]}',
    ])

    # 第2条（代金の支払）
    bank_info = (
        f'（{p["bank_name"]}\n'
        f'　{p["branch_name"]}\n'
        f'　{p.get("account_type", "普通預金")} 口座番号 {p["account_number"]}）\n'
        f'に振込送金して支払う。振込手数料は乙の負担とする。'
    )
    add_article("（代金の支払）", [
        f'第２条 乙は、甲に対し、次のとおり売買代金を支払う。',
        f'',
        f'　売買代金 ： {p["price_tax_included"]:,} 円（税込）',
        f'　支払期日 ： {p["payment_term"]}',
        f'　支払方法 ： 甲の指定する甲名義の金融機関口座',
        f'　　　{bank_info}',
        f'',
        f'２ 乙が代金の支払いを怠ったときは、乙は、甲に対し、前項の支払期日の翌日から完済に至るまで年10％の割合による遅延損害金を支払う。',
    ])

    # 第3条（引渡し）
    add_article("（引渡し）", [
        f'第３条 甲は、乙に対し、次のとおり商品を引き渡す。',
        f'',
        f'　引 渡 日 ： {p["delivery_date"]}',
        f'　引渡場所 ： {p["delivery_location"]}',
        f'',
        f'２ 甲及び乙は、それぞれ相手方の事前の了承を得て、引渡日又は（及び）引渡場所を変更することができる。ただし、その変更により費用が増加した場合には、その増額分は変更を申し出た者の負担とする。',
    ])

    # 第4条（所有権移転時期等）
    add_article("（所有権移転時期等）", [
        f'第４条 商品の所有権移転時期は、甲が乙に商品を引き渡した時とする。',
        f'',
        f'２ 甲が、乙に対し、本契約に基づき商品を引き渡した後の滅失、毀損、盗難、紛失等の危険は乙が負担する。',
    ])

    # 第5条（費用負担）
    add_article("（費用負担）", [
        f'第５条 本契約の締結に要する費用は各自の負担とする。',
    ])

    # 第6条（契約不適合責任）
    add_article("（契約不適合責任）", [
        f'第６条 乙は、種類、品質又は数量について、本契約の内容に適合しない状態のあること（契約不適合）を発見したときは、本契約に基づき乙が商品の引渡しを受けた後{p["defect_period_months"]}か月以内に限り、甲に対し、甲の費用で、不良品の補修又は代替品若しくは不足数量分の引渡し若しくは損害の賠償を請求することができる。',
    ])

    # 第7条（契約の解除）
    add_article("（契約の解除）", [
        f'第７条 甲及び乙は、相手方が本契約に定める相手方の義務を履行しないときは、相当期間を定めた催告の上、本契約を解除することができる。',
        f'',
        f'２ 前項により本契約が解除されたときは、違約の相手方は違約金として{p["penalty_amount"]:,}円を支払わなければならない。',
    ])

    # 第8条（管轄の合意）
    add_article("（管轄の合意）", [
        f'第８条 本契約に関して生じた一切の紛争については、地方裁判所を第一審の専属的合意管轄裁判所とする。',
    ])

    # --- 署名欄 ---
    pdf.ln(6)
    pdf.set_font("gothic", size=10)
    pdf.set_x(lm)
    pdf.cell(content_w, 7, "記入日：　　　　年　　月　　日", new_x="LEFT", new_y="NEXT")
    pdf.ln(8)

    # 甲
    pdf.set_x(lm + 20)
    pdf.cell(40, 7, "甲", new_x="RIGHT")
    pdf.cell(100, 7, COMPANY["address"], new_x="LEFT", new_y="NEXT")
    pdf.set_x(lm + 60)
    pdf.cell(100, 7, COMPANY["name"], new_x="LEFT", new_y="NEXT")
    pdf.set_x(lm + 60)
    pdf.cell(100, 7, COMPANY["person"], new_x="LEFT", new_y="NEXT")
    pdf.ln(10)

    # 乙（空欄）
    pdf.set_x(lm + 20)
    pdf.cell(40, 7, "乙", new_x="LEFT", new_y="NEXT")
    pdf.ln(3)

    labels = ["住所", "会社名", "代表者名", "記入日"]
    for label in labels:
        pdf.set_x(lm + 40)
        pdf.cell(25, 9, label, border=1, align="C")
        pdf.cell(80, 9, "", border=1)
        pdf.ln()

    # --- 出力 ---
    if p.get("output_path"):
        out = p["output_path"]
    else:
        safe_buyer = p["buyer_name"].replace(" ", "_")
        out = os.path.join(
            os.path.dirname(__file__), "..", "invoices",
            f'売買契約書_{safe_buyer}.pdf'
        )
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pdf.output(out)
    print(f"Generated: {out}")
    return out


if __name__ == "__main__":
    generate_contract()
