/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceItem } from "@/lib/invoice/parse";

const BRAND = "#2196F3"; // Krileo blue
const FG = "#0F1729";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const HAIRLINE = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 80,
    paddingHorizontal: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: FG,
    lineHeight: 1.5,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 48,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 38, height: 38 },
  brandName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: FG,
    letterSpacing: 1.5,
  },
  invoiceLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    letterSpacing: 2,
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: FG,
    marginTop: 2,
    textAlign: "right",
  },

  // Meta strip
  meta: {
    flexDirection: "row",
    gap: 32,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: HAIRLINE,
    marginBottom: 32,
  },
  metaCol: { flex: 1 },
  metaLabel: {
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  metaValue: { fontSize: 10.5, color: FG, fontFamily: "Helvetica-Bold" },

  // Parties
  parties: {
    flexDirection: "row",
    gap: 32,
    marginBottom: 36,
  },
  party: { flex: 1 },
  partyHeader: {
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  partyName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: FG,
    marginBottom: 2,
  },
  partyLine: { fontSize: 10, color: MUTED, marginBottom: 1 },

  // Project subline
  project: {
    marginBottom: 24,
  },
  projectTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: FG,
    letterSpacing: 0.2,
  },

  // Items table
  itemsHead: {
    flexDirection: "row",
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: HAIRLINE,
  },
  itemRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
  },
  th: {
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  td: { fontSize: 10.5, color: FG },
  desc: { flex: 5, paddingRight: 12 },
  qty: { flex: 1, textAlign: "right", paddingRight: 12 },
  unit: { flex: 1.5, textAlign: "right", paddingRight: 12 },
  total: { flex: 1.5, textAlign: "right" },

  // Totals
  totals: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 24,
  },
  totalsBox: {
    width: 240,
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: BRAND,
  },
  grandLabel: {
    fontSize: 8,
    color: FAINT,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
    textAlign: "right",
  },
  grandValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: FG,
    textAlign: "right",
  },

  // Notes
  notes: {
    marginTop: 56,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.6,
  },
  notesHeader: {
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
    fontSize: 8,
    color: FAINT,
  },
});

const fmtEuro = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);

const DE = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export type InvoiceData = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;

  sender: {
    name: string;
    addressLines: string[];
    email?: string;
    phone?: string;
    iban?: string;
    bank?: string;
  };

  recipient: {
    name: string;
    addressLines: string[];
    email?: string;
  };

  orderTitle: string;
  orderRef?: string;

  items: InvoiceItem[];
  totalCents: number;

  logoSrc?: string;
};

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document
      title={`Rechnung ${data.invoiceNumber}`}
      author={data.sender.name}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {data.logoSrc && <Image src={data.logoSrc} style={styles.logo} />}
            <Text style={styles.brandName}>KRILEO</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>RECHNUNG</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
          </View>
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
            <Text style={styles.metaLabel}>Auftragsnummer</Text>
            <Text style={styles.metaValue}>{data.orderRef ?? "—"}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyHeader}>Absender</Text>
            <Text style={styles.partyName}>{data.sender.name}</Text>
            {data.sender.addressLines.map((l, i) => (
              <Text key={i} style={styles.partyLine}>
                {l}
              </Text>
            ))}
            {data.sender.email && (
              <Text style={styles.partyLine}>{data.sender.email}</Text>
            )}
            {data.sender.phone && (
              <Text style={styles.partyLine}>{data.sender.phone}</Text>
            )}
          </View>
          <View style={styles.party}>
            <Text style={styles.partyHeader}>Empfänger</Text>
            <Text style={styles.partyName}>{data.recipient.name}</Text>
            {data.recipient.addressLines.map((l, i) => (
              <Text key={i} style={styles.partyLine}>
                {l}
              </Text>
            ))}
            {data.recipient.email && (
              <Text style={styles.partyLine}>{data.recipient.email}</Text>
            )}
          </View>
        </View>

        {/* Project headline */}
        <View style={styles.project}>
          <Text style={styles.partyHeader}>Projekt</Text>
          <Text style={styles.projectTitle}>{data.orderTitle}</Text>
        </View>

        {/* Items table */}
        <View style={styles.itemsHead}>
          <Text style={[styles.th, styles.desc]}>Leistung</Text>
          <Text style={[styles.th, styles.qty]}>Menge</Text>
          <Text style={[styles.th, styles.unit]}>Einzelpreis</Text>
          <Text style={[styles.th, styles.total]}>Betrag</Text>
        </View>
        {data.items.map((it, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={[styles.td, styles.desc]}>{it.description}</Text>
            <Text style={[styles.td, styles.qty]}>{it.quantity}</Text>
            <Text style={[styles.td, styles.unit]}>
              {fmtEuro(it.unitCents)}
            </Text>
            <Text style={[styles.td, styles.total]}>
              {fmtEuro(it.totalCents)}
            </Text>
          </View>
        ))}

        {/* Total */}
        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            <Text style={styles.grandLabel}>Gesamtbetrag</Text>
            <Text style={styles.grandValue}>{fmtEuro(data.totalCents)}</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.notes}>
          <Text style={styles.notesHeader}>Zahlungsinformationen</Text>
          <Text>
            Bitte überweise den Gesamtbetrag innerhalb von 14 Tagen unter
            Angabe der Rechnungsnummer{" "}
            <Text style={{ fontFamily: "Helvetica-Bold", color: FG }}>
              {data.invoiceNumber}
            </Text>
            .
          </Text>
          {data.sender.iban && (
            <Text style={{ marginTop: 4 }}>
              IBAN: {data.sender.iban}
              {data.sender.bank ? `  ·  ${data.sender.bank}` : ""}
            </Text>
          )}
          <Text style={{ marginTop: 8 }}>
            Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
          </Text>
          <Text style={{ marginTop: 14, color: FG }}>
            Vielen Dank für deinen Auftrag.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{data.sender.name}</Text>
          {data.sender.email ? <Text>{data.sender.email}</Text> : <Text> </Text>}
          <Text>krileo.de</Text>
        </View>
      </Page>
    </Document>
  );
}
