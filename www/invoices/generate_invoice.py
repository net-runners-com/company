"""
請求書PDF生成スクリプト
Usage: python3 generate_invoice.py
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# ── フォント登録 ──────────────────────────────────────────
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))   # ゴシック
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiMin-W3'))       # 明朝（数字等）

FONT      = 'HeiseiKakuGo-W5'
FONT_MONO = 'HeiseiMin-W3'

# ── カラー ────────────────────────────────────────────────
NAVY   = colors.HexColor('#1a2340')
ORANGE = colors.HexColor('#e8610a')
MUTED  = colors.HexColor('#888899')
LIGHT  = colors.HexColor('#f7f8fc')
WHITE  = colors.white
BLACK  = colors.HexColor('#1a1a2a')
BORDER = colors.HexColor('#d8d8e8')

# ── 請求書データ ──────────────────────────────────────────
DATA = {
    'invoice_no'    : 'No. 202603-01',
    'issue_date'    : '2026年03月24日',
    'due_date'      : '2026年04月30日',
    'subject'       : 'ホームページ制作',

    'client_name'   : '株式会社サンプル',
    'client_dept'   : '担当者：〇〇 〇〇 様',
    'client_addr'   : '〒000-0000 〇〇県〇〇市〇〇 X-X-X',

    'sender_name'   : 'AI Solutions',
    'sender_addr'   : '〒000-0000 〇〇県〇〇市〇〇 X-X-X',
    'sender_tel'    : '00-0000-0000',
    'sender_email'  : 'info@example.com',

    'items': [
        {
            'name'   : '会社ホームページ制作',
            'detail' : '企画・デザイン・コーディング・納品一式',
            'qty'    : 1,
            'unit'   : '式',
            'price'  : 181819,
        },
    ],
    'tax_rate': 0.10,

    'bank_name'    : '〇〇銀行 〇〇支店',
    'bank_type'    : '普通',
    'bank_number'  : '0000000',
    'bank_holder'  : '〇〇 〇〇（カナ）',

    'notes': [
        '上記の通りご請求申し上げます。',
        'お支払いは下記口座へお振込みください。振込手数料はご負担をお願いいたします。',
        'ご不明な点はお気軽にお問い合わせください。',
    ],
}

# ── ヘルパー ──────────────────────────────────────────────
def money(n):
    return f'¥{n:,}'

def rect_fill(c, x, y, w, h, fill_color, stroke=False):
    c.setFillColor(fill_color)
    if stroke:
        c.setStrokeColor(BORDER)
        c.rect(x, y, w, h, fill=1, stroke=1)
    else:
        c.rect(x, y, w, h, fill=1, stroke=0)

def hline(c, x1, x2, y, color=BORDER, width=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)

def text(c, s, x, y, font=FONT, size=10, color=BLACK, align='left'):
    c.setFont(font, size)
    c.setFillColor(color)
    if align == 'right':
        c.drawRightString(x, y, s)
    elif align == 'center':
        c.drawCentredString(x, y, s)
    else:
        c.drawString(x, y, s)

# ── メイン ────────────────────────────────────────────────
def generate(output_path, data):
    W, H = A4           # 595.28 x 841.89 pt
    M = 20 * mm         # margin

    c = canvas.Canvas(output_path, pagesize=A4)

    # ────────────────────────────────────────────
    # ヘッダーバー
    # ────────────────────────────────────────────
    rect_fill(c, 0, H - 22*mm, W, 22*mm, NAVY)
    text(c, '請　求　書', M, H - 14*mm, size=20, color=WHITE)

    # 右上：番号・日付
    text(c, f'請求書番号　{data["invoice_no"]}', W - M, H - 9*mm,  size=9,  color=colors.HexColor('#aabbcc'), align='right')
    text(c, f'発行日　{data["issue_date"]}',      W - M, H - 15*mm, size=9,  color=colors.HexColor('#aabbcc'), align='right')

    # ────────────────────────────────────────────
    # 請求先 / 請求元
    # ────────────────────────────────────────────
    y_info = H - 38*mm

    # 請求先
    text(c, '請　求　先', M, y_info, size=7, color=ORANGE)
    y_info -= 6*mm
    text(c, data['client_name'] + '　御中', M, y_info, size=14, color=NAVY)
    y_info -= 5.5*mm
    text(c, data['client_addr'], M, y_info, size=8, color=MUTED)
    y_info -= 4.5*mm
    text(c, data['client_dept'], M, y_info, size=8, color=MUTED)

    # 請求元（右寄せ）
    yr = H - 38*mm
    text(c, '請　求　元', W - M, yr, size=7, color=ORANGE, align='right')
    yr -= 6*mm
    text(c, data['sender_name'], W - M, yr, size=13, color=NAVY, align='right')
    yr -= 5.5*mm
    text(c, data['sender_addr'], W - M, yr, size=8, color=MUTED, align='right')
    yr -= 4.5*mm
    text(c, f'Tel: {data["sender_tel"]}　{data["sender_email"]}', W - M, yr, size=8, color=MUTED, align='right')

    # 仕切り線
    hline(c, M, W - M, H - 65*mm, color=BORDER, width=0.5)

    # ────────────────────────────────────────────
    # 金額ボックス
    # ────────────────────────────────────────────
    box_y = H - 85*mm
    box_h = 16*mm
    rect_fill(c, M, box_y, W - 2*M, box_h, NAVY)

    subtotal = sum(i['qty'] * i['price'] for i in data['items'])
    tax      = round(subtotal * data['tax_rate'])
    total    = subtotal + tax

    text(c, 'ご請求金額（税込）', M + 4*mm, box_y + 10*mm, size=8, color=colors.HexColor('#aabbcc'))
    text(c, money(total),          M + 4*mm, box_y + 4*mm,  size=18, color=WHITE)

    text(c, 'お支払期限',          W - M - 4*mm, box_y + 10*mm, size=8,  color=colors.HexColor('#aabbcc'), align='right')
    text(c, data['due_date'],      W - M - 4*mm, box_y + 4*mm,  size=11, color=WHITE, align='right')

    # ────────────────────────────────────────────
    # 明細テーブル
    # ────────────────────────────────────────────
    COL = {
        'name' : M,
        'qty'  : W - M - 95*mm,
        'unit' : W - M - 78*mm,
        'price': W - M - 58*mm,
        'amt'  : W - M,
    }
    ROW_H = 9*mm

    table_top = box_y - 8*mm
    text(c, '明　細', M, table_top + 4*mm, size=7, color=ORANGE)
    table_top -= 1*mm

    # ヘッダー行
    rect_fill(c, M, table_top - ROW_H, W - 2*M, ROW_H, NAVY)
    hy = table_top - ROW_H + 3.2*mm
    text(c, '内　容',   COL['name']  + 2*mm, hy, size=8, color=WHITE)
    text(c, '数量',     COL['qty']   + 2*mm, hy, size=8, color=WHITE)
    text(c, '単位',     COL['unit']  + 2*mm, hy, size=8, color=WHITE)
    text(c, '単　価',   COL['price'] + 2*mm, hy, size=8, color=WHITE)
    text(c, '金　額',   COL['amt'],          hy, size=8, color=WHITE, align='right')

    # アイテム行
    row_y = table_top - ROW_H
    for idx, item in enumerate(data['items']):
        row_y -= ROW_H
        bg = LIGHT if idx % 2 == 0 else WHITE
        rect_fill(c, M, row_y, W - 2*M, ROW_H, bg, stroke=True)
        ry = row_y + 3*mm
        amt = item['qty'] * item['price']
        text(c, item['name'],              COL['name']  + 2*mm, ry + 1.5*mm, size=9)
        text(c, item.get('detail',''),     COL['name']  + 2*mm, ry - 2.5*mm, size=7, color=MUTED)
        text(c, str(item['qty']),          COL['qty']   + 2*mm, ry, size=9)
        text(c, item['unit'],              COL['unit']  + 2*mm, ry, size=9)
        text(c, money(item['price']),      COL['amt']   - 52*mm, ry, size=9, align='right')
        text(c, money(amt),                COL['amt'],           ry, size=9, align='right')

    # 小計・税・合計
    sum_x  = W - M - 70*mm
    sum_x2 = W - M
    sy = row_y - 6*mm

    def sum_row(label, value, bold=False, top_line=False, bottom_line=False):
        nonlocal sy
        if top_line:
            hline(c, sum_x, sum_x2, sy + 5.5*mm, color=NAVY, width=1.5)
        fs = 10 if bold else 9
        fc = NAVY if bold else BLACK
        text(c, label, sum_x2 - 45*mm, sy, size=fs, color=fc if not bold else MUTED)
        text(c, value, sum_x2,          sy, size=fs+2 if bold else fs, color=fc, align='right')
        if bottom_line:
            hline(c, sum_x, sum_x2, sy - 2*mm, color=NAVY, width=1.5)
        sy -= 7*mm

    sum_row('小計（税抜）',             money(subtotal))
    sum_row(f'消費税（{int(data["tax_rate"]*100)}%）', money(tax))
    sum_row('合計（税込）',             money(total),   bold=True, top_line=True, bottom_line=True)

    # ────────────────────────────────────────────
    # 備考
    # ────────────────────────────────────────────
    note_y = sy - 6*mm
    rect_fill(c, M, note_y - len(data['notes']) * 5.5*mm - 6*mm, W - 2*M,
              len(data['notes']) * 5.5*mm + 12*mm, LIGHT)
    # 左アクセントバー
    rect_fill(c, M, note_y - len(data['notes']) * 5.5*mm - 6*mm, 1.5*mm,
              len(data['notes']) * 5.5*mm + 12*mm, ORANGE)

    text(c, '備　考', M + 4*mm, note_y + 2*mm, size=7, color=ORANGE)
    note_y -= 5*mm
    for line in data['notes']:
        text(c, f'・{line}', M + 4*mm, note_y, size=8, color=MUTED)
        note_y -= 5.5*mm

    # ────────────────────────────────────────────
    # 振込先
    # ────────────────────────────────────────────
    bank_y = note_y - 10*mm
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.roundRect(M, bank_y - 18*mm, W - 2*M, 24*mm, 3*mm, fill=0, stroke=1)

    text(c, 'お振込先', M + 4*mm, bank_y + 2*mm, size=7, color=ORANGE)
    bx = [M + 6*mm, M + 55*mm, M + 105*mm, M + 130*mm]
    by = bank_y - 6*mm
    labels = ['金融機関', '口座種別', '口座番号', '口座名義']
    values = [data['bank_name'], data['bank_type'], data['bank_number'], data['bank_holder']]
    for lbl, val, bxi in zip(labels, values, bx):
        text(c, lbl, bxi, by,           size=7, color=MUTED)
        text(c, val, bxi, by - 5.5*mm,  size=9, color=BLACK)

    # ────────────────────────────────────────────
    # フッター
    # ────────────────────────────────────────────
    hline(c, M, W - M, 14*mm, color=BORDER)
    footer_txt = f'{data["sender_name"]}　／　{data["sender_addr"]}　／　{data["sender_email"]}'
    text(c, footer_txt, W / 2, 9*mm, size=7, color=MUTED, align='center')

    c.save()
    print(f'✓ PDF生成完了: {output_path}')

# ── 実行 ─────────────────────────────────────────────────
if __name__ == '__main__':
    import os
    out_dir = '/Users/hirotodev0622i/Desktop/company-test/.company/finance/invoices'
    os.makedirs(out_dir, exist_ok=True)
    generate(os.path.join(out_dir, 'invoice-202603-01.pdf'), DATA)
