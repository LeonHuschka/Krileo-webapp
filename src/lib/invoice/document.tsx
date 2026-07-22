/* eslint-disable jsx-a11y/alt-text */
import fs from "fs";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  Svg,
  Polygon,
} from "@react-pdf/renderer";
import type { InvoiceItem } from "@/lib/invoice/parse";
import {
  fmtMoney,
  billingClause,
  vatCentsOf,
  type InvoiceBillingMode,
  type IssuerSettings,
} from "@/lib/invoice/types";

// ── Fonts: Poppins (rounded, matches the offer) with a Helvetica fallback ────
function registerPoppins(): boolean {
  try {
    const dir = path.join(process.cwd(), "public", "fonts");
    const reg = path.join(dir, "Poppins-Regular.ttf");
    if (!fs.existsSync(reg)) return false;
    Font.register({
      family: "Poppins",
      fonts: [
        { src: reg, fontWeight: 400 },
        { src: path.join(dir, "Poppins-Medium.ttf"), fontWeight: 500 },
        { src: path.join(dir, "Poppins-SemiBold.ttf"), fontWeight: 600 },
        { src: path.join(dir, "Poppins-Bold.ttf"), fontWeight: 700 },
      ],
    });
    return true;
  } catch {
    return false;
  }
}
const HAS_POPPINS = registerPoppins();
Font.registerHyphenationCallback((wd) => [wd]); // don't hyphenate

/** Font style for a weight, working with Poppins or the Helvetica fallback. */
function w(weight: 400 | 500 | 600 | 700) {
  if (HAS_POPPINS) return { fontFamily: "Poppins", fontWeight: weight } as const;
  return weight >= 600
    ? ({ fontFamily: "Helvetica-Bold" } as const)
    : ({ fontFamily: "Helvetica" } as const);
}

const NAVY = "#0C2340";
const NAVY2 = "#16406E"; // lighter navy-blue for the header's diagonal two-tone
const BRAND = "#2196F3";
const FG = "#0F1729";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const HAIRLINE = "#E5E7EB";
const PAD = 44; // content horizontal margin (print-safe inset)

// Print-safe layout: nothing bleeds to the paper edge (home/office printers
// can't print a full-bleed band, and clip a footer that sits too low). The
// header is a rounded navy card inside the margins; the footer sits well
// within the printable area. DIN 5008 (Form B) window geometry preserved.
const MM = 2.83465;
const MTOP = 32; // white margin above the header card
const MBOTTOM = 30; // margin below the footer
const HB_MX = 22; // header card outer horizontal margin
const HB_PV = 16; // header card vertical padding
const HB_PH = PAD - HB_MX; // header text lines up with the body content
const HB_H = HB_PV * 2 + (8.5 * 1.45 + 3 + 15 * 1.45); // header card height
const HEADER_BOTTOM = MTOP + HB_H; // header bottom from the paper top
// "Rechnungsempfänger" label block above the recipient name.
const RECIP_LABEL_H = 7.5 * 1.45 + 6;
const RECIP_TOP = 45 * MM - HEADER_BOTTOM - RECIP_LABEL_H; // name ~45mm from top
const RECIP_LEFT = 25 * MM - PAD; // recipient ~25mm from the page left
const LETTER_ZONE_H = 90 * MM - HEADER_BOTTOM; // subject/title starts ~90mm from top
// DIN 5008 fold marks (Form B), inset so they stay printable.
const FOLD_1 = 105 * MM;
const FOLD_2 = 210 * MM;

const styles = StyleSheet.create({
  page: {
    paddingBottom: 74,
    fontSize: 10,
    color: FG,
    lineHeight: 1.45,
    ...w(400),
  },
  body: { paddingHorizontal: PAD, flexGrow: 1 },

  // Header card (rounded navy with a diagonal blue gradient, inset from edges)
  headerBand: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: NAVY,
    marginTop: MTOP,
    marginHorizontal: HB_MX,
    borderRadius: 8,
    paddingHorizontal: HB_PH,
    paddingTop: HB_PV,
    paddingBottom: HB_PV,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSvg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: { width: 32, height: 32 },
  brandName: {
    fontSize: 18,
    color: "#FFFFFF",
    letterSpacing: 1,
    lineHeight: 1,
    ...w(700),
  },
  invoiceLabel: {
    fontSize: 8.5,
    color: BRAND,
    letterSpacing: 2.5,
    textAlign: "right",
    ...w(600),
  },
  invoiceNumber: {
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 3,
    textAlign: "right",
    ...w(700),
  },

  // Letter head — fixed zone, recipient pinned to the window position
  letterZone: { height: LETTER_ZONE_H, position: "relative", marginBottom: 6 },
  recipientBox: {
    position: "absolute",
    top: RECIP_TOP,
    left: RECIP_LEFT,
    width: 85 * MM,
  },
  recipientHeader: {
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
    ...w(600),
  },
  recipientName: { fontSize: 11.5, color: FG, marginBottom: 2, ...w(600) },
  recipientCompany: { fontSize: 10.5, color: FG, marginBottom: 2, ...w(500) },
  recipientLine: { fontSize: 10.5, color: FG, marginBottom: 1 },

  // DIN fold marks (inset so they stay inside the printable area)
  foldMark: {
    position: "absolute",
    left: HB_MX,
    width: 14,
    height: 0.8,
    backgroundColor: "#B4BCC8",
  },

  issuerBox: {
    position: "absolute",
    top: RECIP_TOP,
    right: RECIP_LEFT, // mirror the recipient's 25mm inset for symmetry
    width: 210,
    alignItems: "flex-end",
  },
  issuerHeader: {
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
    textAlign: "right",
    ...w(600),
  },
  issuerName: { fontSize: 10.5, color: FG, marginBottom: 1, textAlign: "right", ...w(600) },
  issuerLine: { fontSize: 9, color: MUTED, marginBottom: 1, textAlign: "right" },

  // Subject / title
  titleWrap: { marginBottom: 20 },
  kicker: {
    fontSize: 8.5,
    color: BRAND,
    letterSpacing: 2,
    marginBottom: 6,
    ...w(600),
  },
  title: { fontSize: 22, color: FG, ...w(700) },

  // Meta strip
  meta: {
    flexDirection: "row",
    gap: 24,
    paddingTop: 5,
    paddingBottom: 5,
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: HAIRLINE,
    marginBottom: 8,
  },
  metaCol: { flex: 1, alignItems: "center" },
  metaLabel: {
    fontSize: 7,
    color: FAINT,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: 3,
    textAlign: "center",
    ...w(500),
  },
  metaValue: { fontSize: 10, color: FG, textAlign: "center", ...w(600) },

  // Table
  itemsHead: {
    flexDirection: "row",
    paddingTop: 7,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderColor: NAVY,
  },
  itemRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
  },
  th: {
    fontSize: 7.5,
    color: NAVY,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    ...w(600),
  },
  td: { fontSize: 10, color: FG },
  desc: { flex: 5, paddingRight: 12 },
  qty: { flex: 1, textAlign: "right", paddingRight: 12 },
  unit: { flex: 1.6, textAlign: "right", paddingRight: 12 },
  amount: { flex: 1.6, textAlign: "right" },

  // Totals
  totals: { flexDirection: "row", justifyContent: "flex-end", marginTop: 5 },
  totalsBox: { width: 250 },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  subLabel: { fontSize: 9.5, color: MUTED },
  subValue: { fontSize: 9.5, color: FG, ...w(500) },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 5,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: BRAND,
  },
  grandLabel: {
    fontSize: 8,
    color: FAINT,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    ...w(600),
  },
  grandValue: { fontSize: 20, color: FG, ...w(700) },

  // Notes
  notes: {
    marginTop: 6,
    paddingTop: 7,
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.4,
  },
  notesHeader: {
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
    ...w(600),
  },
  bankBlock: {
    marginTop: 5,
    marginBottom: 1,
    paddingLeft: 9,
    borderLeftWidth: 1.5,
    borderLeftColor: BRAND,
  },
  bankLabel: {
    fontSize: 7,
    color: FAINT,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
    ...w(600),
  },
  bankLine: { fontSize: 9, color: FG, marginBottom: 1.5, ...w(500) },

  // Footer band
  footer: {
    position: "absolute",
    bottom: MBOTTOM,
    left: PAD,
    right: PAD,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
  },
  footCell: { flex: 1 },
  footLine: { fontSize: 7.5, color: FAINT, marginBottom: 1 },
  footStrong: { fontSize: 7.5, color: MUTED, ...w(600) },
  footCenterCell: { flex: 1, alignItems: "center" },
  footLogo: { width: 20, height: 20, marginBottom: 3 },
  footCenter: { fontSize: 6.5, color: FAINT, letterSpacing: 1, textAlign: "center" },
  footRight: { textAlign: "right" },
});

const DE = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const fmtQty = (n: number) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);

export type InvoiceData = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  taglineRight: string;
  issuerContact?: string;
  showVat: boolean;
  vatRate: number;

  issuer: IssuerSettings;
  issuerAddressLines: string[];
  recipient: {
    name: string;
    company?: string;
    addressLines: string[];
    email?: string;
    taxId?: string;
  };

  orderTitle: string;
  orderRef?: string;

  items: InvoiceItem[];
  subtotalCents: number;
  totalCents: number;
  discountCents: number;
  discountLabel?: string;

  billingMode: InvoiceBillingMode | null;
  notes: string;

  logoSrc?: string;
};

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const money = (c: number) => fmtMoney(c, data.currency);
  const category =
    data.taglineRight.split("·").pop()?.trim().toUpperCase() ?? "";
  const clause = billingClause(data.billingMode);
  const hasDiscount = data.discountCents > 0;
  const netCents = data.subtotalCents - data.discountCents;
  const vat = vatCentsOf(netCents, data.showVat, data.vatRate);
  const grand = netCents + vat;

  return (
    <Document title={`Rechnung ${data.invoiceNumber}`} author={data.issuer.senderName}>
      <Page size="A4" style={styles.page}>
        {/* Fold marks (DIN 5008, Form B) for a windowed envelope */}
        <View style={[styles.foldMark, { top: FOLD_1 }]} fixed />
        <View style={[styles.foldMark, { top: FOLD_2 }]} fixed />

        {/* Header band: navy card with a diagonal blue gradient behind the
            wordmark. Print-safe (inset, no full bleed). */}
        <View style={styles.headerBand}>
          <Svg style={styles.headerSvg} viewBox="0 0 800 100" preserveAspectRatio="none">
            {/* lighter navy slab on the logo side */}
            <Polygon points="0,0 400,0 320,100 0,100" fill={NAVY2} />
            {/* bright brand stripe along the diagonal */}
            <Polygon points="400,0 428,0 348,100 320,100" fill={BRAND} />
            {/* faint second stripe for depth */}
            <Polygon
              points="150,0 174,0 94,100 70,100"
              fill={BRAND}
              fillOpacity={0.2}
            />
          </Svg>
          <View style={styles.brandRow}>
            {data.logoSrc && <Image src={data.logoSrc} style={styles.logo} />}
            <Text style={styles.brandName}>{data.issuer.brandName}</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>RECHNUNG</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Letter head: fixed-height zone. Recipient is pinned to the DIN
              window position; issuer sits opposite. Reserving the space keeps
              the fold aligned even when the recipient has few/no address lines. */}
          <View style={styles.letterZone}>
            <View style={styles.recipientBox}>
              <Text style={styles.recipientHeader}>Rechnungsempfänger</Text>
              <Text style={styles.recipientName}>{data.recipient.name}</Text>
              {data.recipient.company ? (
                <Text style={styles.recipientCompany}>
                  {data.recipient.company}
                </Text>
              ) : null}
              {data.recipient.addressLines.map((l, i) => (
                <Text key={i} style={styles.recipientLine}>
                  {l}
                </Text>
              ))}
              {data.recipient.taxId ? (
                <Text style={styles.recipientLine}>
                  USt-IdNr.: {data.recipient.taxId}
                </Text>
              ) : null}
            </View>

            <View style={styles.issuerBox}>
              <Text style={styles.issuerHeader}>Rechnungssteller</Text>
              <Text style={styles.issuerName}>{data.issuer.senderName}</Text>
              {data.issuerContact ? (
                <Text style={styles.issuerLine}>{data.issuerContact}</Text>
              ) : null}
              {data.issuerAddressLines.map((l, i) => (
                <Text key={i} style={styles.issuerLine}>
                  {l}
                </Text>
              ))}
            </View>
          </View>

          {/* Subject / title */}
          <View style={styles.titleWrap}>
            <Text style={styles.kicker}>
              RECHNUNG{category ? ` · ${category}` : ""}
            </Text>
            <Text style={styles.title}>{data.orderTitle}</Text>
          </View>

          {/* Meta strip */}
          <View style={styles.meta}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Rechnungsdatum</Text>
              <Text style={styles.metaValue}>{DE(data.invoiceDate)}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Fällig am</Text>
              <Text style={styles.metaValue}>{DE(data.dueDate)}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Auftrag</Text>
              <Text style={styles.metaValue}>{data.orderRef ?? "—"}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Währung</Text>
              <Text style={styles.metaValue}>{data.currency}</Text>
            </View>
          </View>

          {/* Table */}
          <View style={styles.itemsHead}>
            <Text style={[styles.th, styles.desc]}>Leistung</Text>
            <Text style={[styles.th, styles.qty]}>Menge</Text>
            <Text style={[styles.th, styles.unit]}>Einzelpreis</Text>
            <Text style={[styles.th, styles.amount]}>Betrag</Text>
          </View>
          {data.items.map((it, i) => (
            <View key={i} style={styles.itemRow} wrap={false}>
              <Text style={[styles.td, styles.desc]}>{it.description}</Text>
              <Text style={[styles.td, styles.qty]}>
                {it.kind === "hourly"
                  ? `${fmtQty(it.quantity)} Std.`
                  : it.quantity}
              </Text>
              <Text style={[styles.td, styles.unit]}>{money(it.unitCents)}</Text>
              <Text style={[styles.td, styles.amount]}>{money(it.totalCents)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalsBox}>
              {hasDiscount ? (
                <>
                  <View style={styles.subRow}>
                    <Text style={styles.subLabel}>Zwischensumme</Text>
                    <Text style={styles.subValue}>
                      {money(data.subtotalCents)}
                    </Text>
                  </View>
                  <View style={styles.subRow}>
                    <Text style={styles.subLabel}>
                      {data.discountLabel ?? "Rabatt"}
                    </Text>
                    <Text style={[styles.subValue, { color: BRAND }]}>
                      −{money(data.discountCents)}
                    </Text>
                  </View>
                </>
              ) : null}
              <View style={styles.subRow}>
                <Text style={styles.subLabel}>Nettobetrag</Text>
                <Text style={styles.subValue}>{money(netCents)}</Text>
              </View>
              <View style={styles.subRow}>
                <Text style={styles.subLabel}>
                  USt / VAT{data.showVat ? ` (${data.vatRate} %)` : ""}
                </Text>
                <Text style={styles.subValue}>{money(vat)}</Text>
              </View>
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>Gesamtbetrag</Text>
                <Text style={styles.grandValue}>{money(grand)}</Text>
              </View>
            </View>
          </View>

          {/* Flexible spacer: pins the notes block to a constant distance
              above the footer regardless of table/notes length. */}
          <View style={{ flexGrow: 1, minHeight: 16 }} />

          {/* Notes */}
          <View style={styles.notes} wrap={false}>
            <Text style={styles.notesHeader}>Zahlung & Hinweise</Text>
            <Text>
              Bitte begleiche den Gesamtbetrag von{" "}
              <Text style={{ ...w(600), color: FG }}>{money(grand)}</Text>{" "}
              innerhalb von 14 Tagen (NET 14, fällig am {DE(data.dueDate)}) unter
              Angabe der Rechnungsnummer{" "}
              <Text style={{ ...w(600), color: FG }}>{data.invoiceNumber}</Text>.
            </Text>
            {data.issuer.paymentLines.length > 0 ? (
              <View style={styles.bankBlock}>
                <Text style={styles.bankLabel}>
                  Bankverbindung · {data.issuer.paymentMethod}
                </Text>
                {data.issuer.paymentLines.map((l, i) => (
                  <Text key={i} style={styles.bankLine}>
                    {l}
                  </Text>
                ))}
              </View>
            ) : null}
            <Text style={{ marginTop: 4 }}>
              Reverse-Charge-Verfahren: Die Umsatzsteuer schuldet der
              Leistungsempfänger (§ 13b UStG). Alle Beträge in {data.currency}.
            </Text>
            {clause ? <Text style={{ marginTop: 4 }}>{clause}</Text> : null}
            {data.notes.trim() ? (
              <Text style={{ marginTop: 5 }}>{data.notes.trim()}</Text>
            ) : null}
            <Text style={{ marginTop: 5, color: FG }}>
              Vielen Dank für die Zusammenarbeit.
            </Text>
          </View>
        </View>

        {/* Footer band */}
        <View style={styles.footer} fixed>
          <View style={styles.footCell}>
            <Text style={styles.footStrong}>{data.issuer.gf}</Text>
            <Text style={styles.footLine}>{data.issuer.email}</Text>
          </View>
          <View style={styles.footCenterCell}>
            {data.logoSrc ? (
              <Image src={data.logoSrc} style={styles.footLogo} />
            ) : null}
            <Text style={styles.footCenter}>
              {data.issuer.footerNote.toUpperCase()}
            </Text>
          </View>
          <View style={styles.footCell}>
            <Text style={[styles.footStrong, styles.footRight]}>
              {data.taglineRight}
            </Text>
            <Text style={[styles.footLine, styles.footRight]}>
              {data.issuer.phone}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
