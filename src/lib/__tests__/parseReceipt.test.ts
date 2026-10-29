import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildRowsFromWords, foldNegativeLines, parseReceiptText } from '../parseReceipt.ts';

const RECEIPT = (lemonCokeQty: string) => `MEE TARIK
SUBANG SS15
LZ Mee Tarik Sdn Bhd (1491981-U)
No 25G, Jalan SS15/8B,
47500,Subang Jaya, Selangor
SST No. : B16-2310-32000027
INVOICE
Table No: 24
INVOICE No : SB01-C1/89054
Order No : ODA133159
Cover: 4
Date : 22/03/2024 #1
12:01 AM
QTY ITEM
RM
*** Dine In ***
1 CHICKEN FRIED RICE
13.00
鸡肉炒饭
1 ADD ON FRIED EGG 加荷包蛋
2.00
1 LEMON JUICE
3.00
柠檬汁
2 DRINKING WATER (SMALL) @3.00
6.00
饮用水 (小)
${lemonCokeQty} LEMON COKE
6.00
柠檬可乐
1 FRIED DAOXIAO NOODLE
21.00
炒刀削面
1 BEEF 牛肉
1 BRAISED BEEF RAMEN
16.00
红烧牛肉拉面
1 (LAMB) CHINA MURTABAK
10.00
(羊肉) 中国馅料煎饼
1 FRIED DAOXIAO NOODLE
21.00
炒刀削面
1 CHICKEN 鸡肉
9 SubTotal
98.00
Service Tax:
5.88
Rounding Adj
0.02
Net Total
103.90
Visa
103.90
Tax Summary
Service Tax
98.00
5.88`;

for (const qty of ['1', '7']) {
  test(`parses the Mee Tarik receipt when lemon coke qty is read as ${qty}`, () => {
    const parsed = parseReceiptText(RECEIPT(qty));
    const byName = Object.fromEntries(parsed.items.map((item) => [item.name, item]));

    assert.equal(parsed.items.length, 9);
    assert.equal(byName['LEMON COKE'].qty, 1);
    assert.equal(byName['LEMON COKE'].price, 6);
    assert.equal(byName['DRINKING WATER (SMALL)'].qty, 2);
    assert.ok(byName['ADD ON FRIED EGG']);
    assert.ok(byName['FRIED DAOXIAO NOODLE (BEEF)']);
    assert.ok(byName['FRIED DAOXIAO NOODLE (CHICKEN)']);
    assert.ok(parsed.items.every((item) => !/[^\x00-\x7f]/.test(item.name)));
    assert.equal(parsed.subtotal, 98);
    assert.equal(parsed.tax, 5.88);
    assert.equal(parsed.total, 103.9);
    assert.equal(parsed.needsReview, false);
  });
}

const GOLD_CHILI_ROWS = `GOLD CHILI SEAFOOD RESTAURANT
NO. 5, JALAN SS15/8B,
47500 SUBANG JAYA,
TEL: 016 9099 873
SST ID : B16-1808-32000130
INVOICE
TABLE : 004B
ORDER : 00201469
BILL DT: 20/03/2024 07:50:41 PM RM
2 Chicken Boneless -B 48.00
3 SET F @0.00 0.00
1 Beef -B 19.50
2 Salted egg -B @4.00 8.00
1 Plain Omelette -B 10.50
2 Mineral Water-S @1.50 3.00
1 RICE 1.50
9 SUB TOTAL 90.50
Services Tax 6% 5.43
ROUNDING ADJ 0.02
NET TOTAL 95.95
Thank You`;

test('parses the Gold Chili receipt from rebuilt rows', () => {
  const parsed = parseReceiptText(GOLD_CHILI_ROWS);
  const summary = parsed.items.map((item) => [item.name, item.qty, item.price]);

  assert.deepEqual(summary, [
    ['Chicken Boneless -B', 2, 48],
    ['Beef -B', 1, 19.5],
    ['Salted egg -B', 2, 8],
    ['Plain Omelette -B', 1, 10.5],
    ['Mineral Water-S', 2, 3],
    ['RICE', 1, 1.5],
  ]);
  assert.equal(parsed.subtotal, 90.5);
  assert.equal(parsed.tax, 5.43);
  assert.equal(parsed.total, 95.95);
  assert.equal(parsed.needsReview, false);
});

test('buildRowsFromWords aligns a tilted price column with its names', () => {
  const tilt = -0.03;
  const place = (text: string, x: number, baseY: number) => {
    const y = baseY + x * Math.tan(tilt);
    return {
      text,
      vertices: [
        { x, y },
        { x: x + text.length * 12, y: y + (text.length * 12) * Math.tan(tilt) },
        { x: x + text.length * 12, y: y + 24 },
        { x, y: y + 24 },
      ],
    };
  };
  const rows = buildRowsFromWords([
    place('Beef', 100, 300),
    place('19.50', 600, 300),
    place('Salted', 100, 340),
    place('8.00', 600, 340),
    place('RICE', 100, 380),
    place('1.50', 600, 380),
  ]);

  assert.deepEqual(rows, ['Beef 19.50', 'Salted 8.00', 'RICE 1.50']);
});

const TGIF_ROWS = `SST No: W10-2308-32000083
**TAX INVOICE**
*Bill ID:;Date:;Customer No:;;;;*
2 TGIF1 1157 KISHAN RAJ
Chk 2906 Guest2
28/08/2025 03:01:23 PM
TBL20 / 1
1 SL WAFFLE CHKN 19.90
1 SL CHKN FINGER 19.90
1 SL BUFF PASTA 24.90
1 COKE ZERO 0.00
1 MM ORANGE 0.00
1 SPRITE 0.00
1 CARIBBEAN CHKN 32.90
1 BROWNIE 19.90
NOW
OPEN INFO
1 MINERAL WATER 4.90
1 ICED CHOCOLATE 10.90
Subtotal 133.30
10% Srv Chg 13.33
6% SST 8.00
Rnd Adj 0.02
Ttl Aft Rnd 154.65
Total 154.65
THIS IS NOT AN ACTUAL RECEIPT`;

test('parses the TGIF receipt including Srv Chg and Ttl Aft Rnd', () => {
  const parsed = parseReceiptText(TGIF_ROWS);

  assert.deepEqual(
    parsed.items.map((item) => [item.name, item.qty, item.price]),
    [
      ['SL WAFFLE CHKN', 1, 19.9],
      ['SL CHKN FINGER', 1, 19.9],
      ['SL BUFF PASTA', 1, 24.9],
      ['CARIBBEAN CHKN', 1, 32.9],
      ['BROWNIE', 1, 19.9],
      ['MINERAL WATER', 1, 4.9],
      ['ICED CHOCOLATE', 1, 10.9],
    ]
  );
  assert.equal(parsed.subtotal, 133.3);
  assert.equal(parsed.serviceCharge, 13.33);
  assert.equal(parsed.tax, 8);
  assert.equal(parsed.total, 154.65);
  assert.equal(parsed.needsReview, false);
});

const MEE_TARIK_DEC_ROWS = `PRN ON : 14/12/2023 10:28 PM
QTY ITEM RM
*** Dine In ***
1 LEMON JUICE 3.00
柠檬汁
1 CHINESE TEA 1.00
中国茶
1 ICED 冷
1 FRIED DUMPLING (12 PCS) 16.00
锅贴 (12 个)
1 BEEF 牛肉
1 BEEF FRIED RICE 16.00
牛肉炒饭
1 FRIED DAOXIAO NOODLE 21.00
炒刀削面
1 BEEF 牛肉
1 ADD ON FRIED EGG 加荷包蛋 2.00
1 BRAISED BEEF RAMEN 16.00
红烧牛肉拉面
1 CLASSIC KOPI 3.00
咖啡
1 ICED 冷
1 BEEF DAOXIAO NOODLE 14.00
牛肉刀削面
8 SubTotal 92.00
Service Tax: 5.52
Rounding Adj -0.02
Net Total 97.50
Visa 97.50
*** 14/12/2023 10:28 PM ***`;

test('parses the Dec 2023 Mee Tarik receipt with modifiers and CJK-only lines', () => {
  const parsed = parseReceiptText(MEE_TARIK_DEC_ROWS);

  assert.deepEqual(
    parsed.items.map((item) => [item.name, item.price]),
    [
      ['LEMON JUICE', 3],
      ['CHINESE TEA (ICED)', 1],
      ['FRIED DUMPLING (12 PCS) (BEEF)', 16],
      ['BEEF FRIED RICE', 16],
      ['FRIED DAOXIAO NOODLE (BEEF)', 21],
      ['ADD ON FRIED EGG', 2],
      ['BRAISED BEEF RAMEN', 16],
      ['CLASSIC KOPI (ICED)', 3],
      ['BEEF DAOXIAO NOODLE', 14],
    ]
  );
  assert.equal(parsed.subtotal, 92);
  assert.equal(parsed.tax, 5.52);
  assert.equal(parsed.total, 97.5);
  assert.equal(parsed.needsReview, false);
});

test('buildRowsFromWords pairs prices by order when the price column drifts and a modifier row sits between', () => {
  const box = (text: string, x: number, y: number) => ({
    text,
    vertices: [
      { x, y },
      { x: x + text.length * 14, y },
      { x: x + text.length * 14, y: y + 30 },
      { x, y: y + 30 },
    ],
  });
  const rows = buildRowsFromWords([
    box('1', 40, 250),
    box('LEMON', 100, 250),
    box('JUICE', 220, 250),
    box('3.00', 800, 245),
    box('1', 40, 340),
    box('CHINESE', 100, 340),
    box('TEA', 260, 340),
    box('1.00', 800, 322),
    box('1', 40, 425),
    box('ICED', 100, 425),
    box('1', 40, 468),
    box('FRIED', 100, 468),
    box('DUMPLING', 200, 468),
    box('16.00', 800, 448),
    box('1', 40, 560),
    box('BEEF', 100, 560),
    box('Subtotal', 40, 700),
    box('20.00', 800, 722),
    box('Total', 40, 760),
    box('20.00', 800, 790),
  ]);

  assert.deepEqual(rows, [
    '1 LEMON JUICE 3.00',
    '1 CHINESE TEA 1.00',
    '1 ICED',
    '1 FRIED DUMPLING 16.00',
    '1 BEEF',
    'Subtotal 20.00',
    'Total 20.00',
  ]);
});

test('reads the Halab Gate table receipt with unit price and total columns', () => {
  const box = (text: string, x: number, y: number) => ({
    text,
    vertices: [
      { x, y },
      { x: x + text.length * 12, y },
      { x: x + text.length * 12, y: y + 20 },
      { x, y: y + 20 },
    ],
  });
  const right = (text: string, edge: number, y: number) => box(text, edge - text.length * 12, y);
  const item = (name: string, qty: string, unit: string, total: string, y: number) => [
    ...name.split(' ').map((word, i) => box(word, 40 + i * 90, y)),
    box(qty, 340, y),
    right(unit, 470, y - 4),
    right(total, 560, y - 6),
  ];

  const rows = buildRowsFromWords([
    box('Halab', 200, 100),
    box('Gate', 280, 100),
    box('Item', 40, 200),
    box('QTY', 340, 200),
    box('Price', 400, 200),
    box('Total', 500, 200),
    ...item('Arabic Chicken', '1', '55.00', '55.00', 260),
    box('Shawarma', 40, 290),
    ...item('Mineral Water', '2', '5.00', '10.00', 330),
    ...item('Strawberry', '1', '19.00', '19.00', 370),
    box('Milkeshake', 40, 400),
    ...item('Lentil Soup', '1', '12.00', '12.00', 440),
    ...item('Fahsah Chicken', '1', '22.00', '22.00', 480),
    ...item('Shish Tawooq', '1', '30.00', '30.00', 520),
    ...item('Mineral Water', '1', '5.00', '5.00', 560),
    box('Service', 40, 600),
    box('Percent', 200, 600),
    box('%', 300, 600),
    box('Amt', 480, 600),
    box('Service', 40, 640),
    box('Charge', 130, 640),
    box('10', 250, 640),
    box('15.3', 330, 640),
    box('QTY', 40, 700),
    box('8', 340, 700),
    box('Net', 400, 700),
    right('153.00', 560, 694),
    box('Discount', 120, 760),
    right('0.00', 560, 754),
    box('Grand', 120, 800),
    box('Total', 190, 800),
    box('Amt', 270, 800),
    right('153.00', 560, 794),
    box('Service', 120, 840),
    box('Charge', 210, 840),
    right('15.30', 560, 834),
    box('Paid', 100, 880),
    box('168.30', 200, 880),
    box('Card', 380, 920),
    right('168.30', 560, 914),
    box('Remain', 80, 940),
    box('0.00', 200, 940),
    box('Total', 400, 980),
    right('168.30', 560, 974),
  ]).join('\n');

  const parsed = parseReceiptText(rows);

  assert.deepEqual(
    parsed.items.map((item) => [item.name, item.qty, item.price]),
    [
      ['Arabic Chicken Shawarma', 1, 55],
      ['Mineral Water', 2, 10],
      ['Strawberry Milkeshake', 1, 19],
      ['Lentil Soup', 1, 12],
      ['Fahsah Chicken', 1, 22],
      ['Shish Tawooq', 1, 30],
      ['Mineral Water', 1, 5],
    ]
  );
  assert.equal(parsed.subtotal, 153);
  assert.equal(parsed.serviceCharge, 15.3);
  assert.equal(parsed.tax, null);
  assert.equal(parsed.discount, null);
  assert.equal(parsed.total, 168.3);
  assert.equal(parsed.needsReview, false);
});

const SUSHI_ROWS = `INVOICE
Table No.10
Invoice. : POSEE304823
Order No. : ONL18859
21 Jun 2026
Pax :0
1 Salmon Teriyaki Don 14.80 D
1 Genmaicha Hot 1.00 D
1 Tori Katsu Curry Rice 13.80 D
1 Tori Katsu Don 12.80 D
1 Tori Katsu Curry Rice 13.80 D
1 Genmaicha Cold 1.00 D
1 Sushi 1.80 1.80 D
10 Sushi 2.80 28.00 D
Subtotal 87.00
Service Charge 10% 8.70
Tax 6% 5.22
Round Adj -0.02
TOTAL 100.90
Closed at 21 Jun 2026 03:59:54 PM
Cashier [dinesh] 100.90`;

test('parses the sushi receipt with tax-code suffixes, qty 10 and trailing junk', () => {
  const parsed = parseReceiptText(SUSHI_ROWS);

  assert.deepEqual(
    parsed.items.map((item) => [item.name, item.qty, item.price]),
    [
      ['Salmon Teriyaki Don', 1, 14.8],
      ['Genmaicha Hot', 1, 1],
      ['Tori Katsu Curry Rice', 1, 13.8],
      ['Tori Katsu Don', 1, 12.8],
      ['Tori Katsu Curry Rice', 1, 13.8],
      ['Genmaicha Cold', 1, 1],
      ['Sushi 1.80', 1, 1.8],
      ['Sushi 2.80', 10, 28],
    ]
  );
  assert.equal(parsed.subtotal, 87);
  assert.equal(parsed.serviceCharge, 8.7);
  assert.equal(parsed.tax, 5.22);
  assert.equal(parsed.total, 100.9);
  assert.equal(parsed.needsReview, false);
});

test('buildRowsFromWords keeps the price before a trailing tax-code column', () => {
  const box = (text: string, x: number, y: number) => ({
    text,
    vertices: [
      { x, y },
      { x: x + text.length * 10, y },
      { x: x + text.length * 10, y: y + 16 },
      { x, y: y + 16 },
    ],
  });
  const rows = buildRowsFromWords([
    box('1', 70, 310),
    box('Salmon', 120, 310),
    box('Teriyaki', 190, 310),
    box('Don', 270, 310),
    box('14.80', 380, 308),
    box('D', 440, 308),
    box('1', 70, 335),
    box('Genmaicha', 120, 335),
    box('Hot', 220, 335),
    box('1.00', 385, 333),
    box('D', 440, 333),
    box('Subtotal', 160, 520),
    box('87.00', 445, 518),
  ]);

  assert.deepEqual(rows, ['1 Salmon Teriyaki Don 14.80 D', '1 Genmaicha Hot 1.00 D', 'Subtotal 87.00']);
});

const MAN_JOE_ROWS = `TAX INVOICE
Member No : ER00117326
Point Before : 176
TAX INVOICE No : 09-TGM-C01/120904
Order No : W0117503 Cover: 1
Date : 14/06/2026 #1 3:39 PM
QTY ITEM RM
*** Dine In ***
1 C10 24.50
XL CrispChic+Tomato Noodle(BIG)
XL Crispy Chic+Tomatoes Noodle(Double Nod
1
KnifeCut Noodle (C)
Knife Cut
1
Cheese
Cheese
1 G05 1.20
Spring Water
纯水
1 H01 15.90
Braised Minced Chicken,Mushroom With Rice
Braised Minced Chicken,Mushroom With Rice
1 C18 21.90
Pumpkin Puree Scallion Oil Minced Chicken
Pumpkin Puree Scallion Oil Chicken Noodle
1
Thin Noodle (A)
Thin
1
Mildly Spicy
Mildly Spicy
1 C10 19.50
XL CrispChic+Tomato Noodle(REGULAR)
XL Crisp Chic+Tomato Noodle(REGULAR)
1
KnifeCut Noodle (C)
Knife Cut
1
Cheese
Cheese
1 C10 19.50
XL CrispChic+Tomato Noodle(REGULAR)
XL Crisp Chic+Tomato Noodle(REGULAR)
1
KnifeCut Noodle (C)
Knife Cut
6 SubTotal 102.50
Service Charge@6%: 6.15
SST @6%: 6.15
Net Total 114.80
Duit Now 114.80
*** 14/06/2026 4:11 PM ***
Tax Summary Taxable GST
SST @6% 102.50 6.15`;

test('names code-based items from their description line and ignores modifiers', () => {
  const parsed = parseReceiptText(MAN_JOE_ROWS);

  assert.deepEqual(
    parsed.items.map((item) => [item.name, item.qty, item.price]),
    [
      ['XL CrispChic+Tomato Noodle(BIG)', 1, 24.5],
      ['Spring Water', 1, 1.2],
      ['Braised Minced Chicken,Mushroom With Rice', 1, 15.9],
      ['Pumpkin Puree Scallion Oil Minced Chicken', 1, 21.9],
      ['XL CrispChic+Tomato Noodle(REGULAR)', 1, 19.5],
      ['XL CrispChic+Tomato Noodle(REGULAR)', 1, 19.5],
    ]
  );
  assert.equal(parsed.subtotal, 102.5);
  assert.equal(parsed.serviceCharge, 6.15);
  assert.equal(parsed.tax, 6.15);
  assert.equal(parsed.total, 114.8);
  assert.equal(parsed.needsReview, false);
});

const MAN_JOE_QTY2_ROWS = `QTY ITEM RM
*** Dine In ***
1 H05 21.90
Japanese Katsu Curry Chicken Popcorn Rice
日式咖喱猪排鸡饭套餐
2 G05 @1.20 2.40
Spring Water
纯水
1 C10 19.50
XL CrispChic+Tomato Noodle(REGULAR)
XL Crisp Chic+Tomato Noodle(REGULAR)
1
Knife Cut Noodle (C)
Knife Cut 刀削面
1
Cheese
Cheese
1 C10 19.50
XL CrispChic+Tomato Noodle(REGULAR)
XL Crisp Chic+Tomato Noodle(REGULAR)
1 C10 19.50
XL CrispChic+Tomato Noodle(REGULAR)
XL Crisp Chic+Tomato Noodle(REGULAR)
1 C10 19.50
XL CrispChic+Tomato Noodle(REGULAR)
XL Crisp Chic+Tomato Noodle(REGULAR)
7 SubTotal 102.30
Service Charge@6%: 6.14
SST @6%: 6.14
Rounding Adj 0.02
Net Total 114.60
Duit Now 114.60
Tax Summary Taxable GST
SST @6% 102.30 6.14`;

test('reads a code item with an @unit price and quantity 2', () => {
  const parsed = parseReceiptText(MAN_JOE_QTY2_ROWS);

  assert.deepEqual(
    parsed.items.map((item) => [item.name, item.qty, item.price]),
    [
      ['Japanese Katsu Curry Chicken Popcorn Rice', 1, 21.9],
      ['Spring Water', 2, 2.4],
      ['XL CrispChic+Tomato Noodle(REGULAR)', 1, 19.5],
      ['XL CrispChic+Tomato Noodle(REGULAR)', 1, 19.5],
      ['XL CrispChic+Tomato Noodle(REGULAR)', 1, 19.5],
      ['XL CrispChic+Tomato Noodle(REGULAR)', 1, 19.5],
    ]
  );
  assert.equal(parsed.subtotal, 102.3);
  assert.equal(parsed.serviceCharge, 6.14);
  assert.equal(parsed.tax, 6.14);
  assert.equal(parsed.total, 114.6);
  assert.equal(parsed.needsReview, false);
});

test('reads the real Vision output of the second Man Joe receipt', () => {
  const words = JSON.parse(readFileSync(new URL('./fixtures/man-joe-2.words.json', import.meta.url), 'utf8'));
  const parsed = parseReceiptText(buildRowsFromWords(words).join('\n'));

  assert.deepEqual(
    parsed.items.map((item) => [item.qty, item.price]),
    [
      [1, 21.9],
      [2, 2.4],
      [1, 19.5],
      [1, 19.5],
      [1, 19.5],
      [1, 19.5],
    ]
  );
  assert.equal(parsed.items[0].name, 'Japanese Katsu Curry Chicken Popcorn Rice');
  assert.equal(parsed.items[1].name, 'Spring Water');
  assert.equal(parsed.subtotal, 102.3);
  assert.equal(parsed.serviceCharge, 6.14);
  assert.equal(parsed.tax, 6.14);
  assert.equal(parsed.total, 114.6);
  assert.equal(parsed.needsReview, false);
});

test('keeps the discount when the subtotal is printed before it', () => {
  const parsed = parseReceiptText(`KEDAI KOPI
1 Nasi Lemak 12.00
1 Teh Tarik 3.50
SUBTOTAL 15.50
DISCOUNT 1.55
SST 6% 0.84
TOTAL 14.79`);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.subtotal, 15.5);
  assert.equal(parsed.discount, 1.55);
  assert.equal(parsed.total, 14.79);
  assert.equal(parsed.needsReview, false);
});

test('keeps the discount when the subtotal is printed after it', () => {
  const parsed = parseReceiptText(`KEDAI KOPI
1 Nasi Lemak 12.00
1 Teh Tarik 3.50
DISCOUNT 1.50
SUBTOTAL 14.00
TOTAL 14.00`);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.subtotal, 14);
  assert.equal(parsed.discount, 1.5);
  assert.equal(parsed.total, 14);
  assert.equal(parsed.needsReview, false);
});

const MCDONALDS = `Seating : 150
Your order number is
143
Gerbang Alaf Restaurants Sdn Bhd
(65351-M)
Licensee of McDonald's
Level 6, Bangunan TH, Damansara Uptown3
No.3, Jalan SS21/39,47400 Petaling Jaya
Selangor
(CP ID No: B16-1808-31010640)
McDonald's Sentul UOA DT (#408)
TAX INVOICE
MFY Side 1 / MFY Side 3
INV# 104083100000213
ORD #43 -CSO #31- 18/12/2020 09:55:38
QTY ITEM TOTAL
1 Nasi Lemak McD 5.65
1 M 12oz HotMilo 2.07
1 M Porridge 6.23
1 Hash Brown 4.06
1 BM BigBrkfst 12.17
1 S Hot Teh Tarik -0.38
1 BM 2HotCakes 11.23
1 S Hot Teh Tarik -0.38
1 RMHC Donation 0.91
Subtotal 41.56
Eat-In Total (incl Tax) 44.00
Mastercard 44.00
TOTAL 6% Service Tax 2.44
* Indicates tax free items
-- Cashless transaction information --`;

test('a total labelled "(incl Tax)" is the total, and the separate tax line is the tax', () => {
  const receipt = parseReceiptText(MCDONALDS);
  assert.equal(receipt.subtotal, 41.56);
  assert.equal(receipt.tax, 2.44);
  assert.equal(receipt.total, 44);
  assert.equal(receipt.serviceCharge, null);
  assert.equal(receipt.needsReview, false);
});

test('negative lines are folded into the item above them', () => {
  const receipt = parseReceiptText(MCDONALDS);
  assert.deepEqual(receipt.items, [
    { name: 'Nasi Lemak McD', price: 5.65, qty: 1 },
    { name: 'M 12oz HotMilo', price: 2.07, qty: 1 },
    { name: 'M Porridge', price: 6.23, qty: 1 },
    { name: 'Hash Brown', price: 4.06, qty: 1 },
    { name: 'BM BigBrkfst (S Hot Teh Tarik)', price: 11.79, qty: 1 },
    { name: 'BM 2HotCakes (S Hot Teh Tarik)', price: 10.85, qty: 1 },
    { name: 'RMHC Donation', price: 0.91, qty: 1 },
  ]);
  const sum = receipt.items.reduce((total, item) => total + item.price, 0);
  assert.equal(Math.round(sum * 100), 4156);
});

test('"incl SST" and "inclusive of tax" qualifiers do not turn a total into tax', () => {
  ['Total (incl. SST) 53.00', 'Total inclusive of tax 53.00'].forEach((totalLine) => {
    const receipt = parseReceiptText(`1 Rice 50.00\nSubtotal 50.00\nSST 6% 3.00\n${totalLine}`);
    assert.equal(receipt.tax, 3, totalLine);
    assert.equal(receipt.total, 53, totalLine);
  });
});

test('a minus sign only counts when it stands apart from the name', () => {
  const spaced = parseReceiptText('1 Burger 10.00\n1 Coupon -2.00\nSubtotal 8.00');
  assert.deepEqual(spaced.items, [{ name: 'Burger (Coupon)', price: 8, qty: 1 }]);

  const dashed = parseReceiptText('1 Set-Meal 5.00\nSubtotal 5.00');
  assert.deepEqual(dashed.items, [{ name: 'Set-Meal', price: 5, qty: 1 }]);
});

test('a discount line stays a positive discount amount', () => {
  const receipt = parseReceiptText('1 Rice 10.00\nSubtotal 10.00\nDiscount -2.00');
  assert.equal(receipt.discount, 2);
});

test('foldNegativeLines merges into the previous item, summing the price', () => {
  const folded = foldNegativeLines([
    { name: 'Burger', price: 10, qty: 1 },
    { name: 'Coupon', price: -1.5, qty: 1 },
    { name: 'Fries', price: 4, qty: 1 },
  ]);
  assert.deepEqual(folded, [
    { name: 'Burger (Coupon)', price: 8.5, qty: 1 },
    { name: 'Fries', price: 4, qty: 1 },
  ]);
});

test('foldNegativeLines folds several negative lines under one item', () => {
  const folded = foldNegativeLines([
    { name: 'Set', price: 10, qty: 1 },
    { name: 'Swap', price: -1, qty: 1 },
    { name: 'Promo', price: -2, qty: 1 },
  ]);
  assert.deepEqual(folded, [{ name: 'Set (Swap) (Promo)', price: 7, qty: 1 }]);
});

test('foldNegativeLines keeps a negative line that has nothing to fold into', () => {
  const lone = [{ name: 'Voucher', price: -5, qty: 1 }];
  assert.deepEqual(foldNegativeLines(lone), lone);
});

test('foldNegativeLines keeps a line that would take the item to zero or below', () => {
  const items = [
    { name: 'Water', price: 2, qty: 1 },
    { name: 'Promo', price: -3, qty: 1 },
  ];
  assert.deepEqual(foldNegativeLines(items), items);
});

test('foldNegativeLines keeps a line that would break an even per-unit price', () => {
  const items = [
    { name: 'Teh', price: 6, qty: 2 },
    { name: 'Promo', price: -0.01, qty: 1 },
  ];
  assert.deepEqual(foldNegativeLines(items), items);
});

test('foldNegativeLines does not change the items it is given', () => {
  const items = [
    { name: 'Burger', price: 10, qty: 1 },
    { name: 'Coupon', price: -1, qty: 1 },
  ];
  foldNegativeLines(items);
  assert.equal(items[0].price, 10);
  assert.equal(items.length, 2);
});
