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

// Brand color: Krileo blue
const BRAND = "#2196F3";
const FG = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: FG,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  logo: { width: 64, height: 64 },
  brand: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    letterSpacing: 1,
  },
  brandSub: { fontSize: 9, color: MUTED, marginTop: 2 },
  invoiceMeta: {
    textAlign: "right",
  },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: FG,
    letterSpacing: 1,
    marginBottom: 6,
  },
  metaRow: { fontSize: 9, color: MUTED, marginBottom: 1 },
  metaValue: { color: FG, fontFamily: "Helvetica-Bold" },

  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  party: { flex: 1, paddingRight: 16 },
  partyLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  partyName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  partyLine: { fontSize: 10, color: FG, marginBottom: 1 },

  table: {
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  tableHead: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#F8FAFC",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  th: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 6,
  },
  td: {
    fontSize: 10,
    color: FG,
    paddingHorizontal: 6,
  },
  colDesc: { flex: 5 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },

  totals: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsBox: {
    width: 240,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: { fontSize: 10, color: MUTED },
  totalsValue: { fontSize: 10, color: FG },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: BRAND,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  grandLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: FG },
  grandValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BRAND },

  notes: {
    marginTop: 36,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    fontSize: 9,
    color: MUTED,
  },
  notesLine: { marginBottom: 2 },

  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
});

const fmtEuro = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);

export type InvoiceData = {
  invoiceNumber: string;
  invoiceDate: string; // ISO
  dueDate: string; // ISO
  vatRate: number;

  sender: {
    name: string;
    addressLines: string[];
    email?: string;
    phone?: string;
    taxId?: string;
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
  netCents: number;
  vatCents: number;
  grossCents: number;

  logoSrc?: string;
};

const DE = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document
      title={`Rechnung ${data.invoiceNumber}`}
      author={data.sender.name}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {data.logoSrc && (
              <Image src={data.logoSrc} style={styles.logo} />
            )}
            <View>
              <Text style={styles.brand}>KRILEO</Text>
              <Text style={styles.brandSub}>
                Websites · Automations · Systeme
              </Text>
            </View>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceTitle}>RECHNUNG</Text>
            <Text style={styles.metaRow}>
              Rechnungs-Nr.{" "}
              <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
            </Text>
            <Text style={styles.metaRow}>
              Datum <Text style={styles.metaValue}>{DE(data.invoiceDate)}</Text>
            </Text>
            <Text style={styles.metaRow}>
              Fällig <Text style={styles.metaValue}>{DE(data.dueDate)}</Text>
            </Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Von</Text>
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
            <Text style={styles.partyLabel}>An</Text>
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

        {/* Project subline */}
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.partyLabel}>Projekt</Text>
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>
            {data.orderTitle}
          </Text>
          {data.orderRef && (
            <Text style={{ fontSize: 9, color: MUTED }}>
              Auftrag #{data.orderRef}
            </Text>
          )}
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colDesc]}>Position</Text>
            <Text style={[styles.th, styles.colQty]}>Menge</Text>
            <Text style={[styles.th, styles.colUnit]}>Einzelpreis</Text>
            <Text style={[styles.th, styles.colTotal]}>Gesamt</Text>
          </View>
          {data.items.map((it, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.colDesc]}>{it.description}</Text>
              <Text style={[styles.td, styles.colQty]}>{it.quantity}</Text>
              <Text style={[styles.td, styles.colUnit]}>
                {fmtEuro(it.unitCents)}
              </Text>
              <Text style={[styles.td, styles.colTotal]}>
                {fmtEuro(it.totalCents)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Zwischensumme (netto)</Text>
              <Text style={styles.totalsValue}>{fmtEuro(data.netCents)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                MwSt. ({Math.round(data.vatRate * 100)}%)
              </Text>
              <Text style={styles.totalsValue}>{fmtEuro(data.vatCents)}</Text>
            </View>
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Gesamtbetrag</Text>
              <Text style={styles.grandValue}>{fmtEuro(data.grossCents)}</Text>
            </View>
          </View>
        </View>

        {/* Notes / payment */}
        <View style={styles.notes}>
          <Text style={styles.notesLine}>
            Bitte überweise den Gesamtbetrag innerhalb von 14 Tagen unter
            Angabe der Rechnungsnummer{" "}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              {data.invoiceNumber}
            </Text>
            .
          </Text>
          {data.sender.iban && (
            <Text style={styles.notesLine}>
              IBAN: {data.sender.iban}
              {data.sender.bank ? ` · ${data.sender.bank}` : ""}
            </Text>
          )}
          {data.sender.taxId && (
            <Text style={styles.notesLine}>USt-IdNr.: {data.sender.taxId}</Text>
          )}
          <Text style={[styles.notesLine, { marginTop: 6 }]}>
            Vielen Dank für deinen Auftrag.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{data.sender.name}</Text>
          <Text>{data.sender.email ?? ""}</Text>
          <Text>krileo.de</Text>
        </View>
      </Page>
    </Document>
  );
}
