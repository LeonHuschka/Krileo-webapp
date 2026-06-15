/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// Krileo brand palette — calm, premium, teal-green accent (matches the
// app's emerald "Offer" styling and the screenshot mock).
const ACCENT = "#0F766E"; // teal-700
const FG = "#0F1729";
const MUTED = "#5B6472";
const FAINT = "#9CA3AF";
const HAIRLINE = "#E5E7EB";
const PANEL = "#F4F6F5";

// Sender block. Fill in the legal details once and they flow into every
// Auftrag/Angebot. Empty fields are simply skipped (no ugly placeholders).
export const KRILEO_SENDER = {
  name: "KRILEO",
  slogan: "MEHR KUNDEN. WENIGER AUFWAND.",
  owner: "Leon Huschka", // Inhaber / Firmierung
  addressLine: "", // z.B. "Musterstraße 1, 70173 Stuttgart"
  contact: "hi@krileo.de · krileo.de",
  vatId: "", // USt-IdNr.
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingBottom: 72,
    paddingHorizontal: 56,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: FG,
    lineHeight: 1.5,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: FG,
    marginBottom: 34,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 26, height: 26 },
  brandName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: FG,
    letterSpacing: 2,
  },
  slogan: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 1.6,
  },

  // Title
  title: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: FG,
    marginBottom: 8,
  },
  titleRule: {
    width: 52,
    height: 3,
    backgroundColor: ACCENT,
    marginBottom: 30,
  },

  // Meta (Kunde / Datum)
  meta: { flexDirection: "row", gap: 32, marginBottom: 32 },
  metaCol: { flex: 1 },
  label: {
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  metaName: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: FG },
  metaLine: { fontSize: 10, color: MUTED },

  // Section
  section: { marginBottom: 26 },
  sectionLabel: {
    fontSize: 8.5,
    color: ACCENT,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  bodyText: { fontSize: 11, color: FG, lineHeight: 1.55 },

  // Investition panel
  panel: {
    backgroundColor: PANEL,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  priceLabel: { fontSize: 11, color: FG },
  priceValueWrap: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  priceValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: FG },
  priceSuffix: { fontSize: 8.5, color: FAINT },

  // Signature
  signatures: {
    flexDirection: "row",
    gap: 36,
    marginTop: 18,
  },
  sigCol: { flex: 1 },
  sigLine: {
    borderTopWidth: 0.75,
    borderTopColor: FG,
    paddingTop: 6,
    marginBottom: 3,
  },
  sigCaption: { fontSize: 9, color: FG },
  sigSub: { fontSize: 8.5, color: FAINT },

  fineprint: {
    fontSize: 8.5,
    color: FAINT,
    lineHeight: 1.5,
    marginTop: 22,
  },

  footer: {
    position: "absolute",
    bottom: 30,
    left: 56,
    right: 56,
    paddingTop: 9,
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
    textAlign: "center",
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 0.4,
  },
});

const fmtEuro = (eur: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(eur);

export type OfferPriceItem = {
  label: string;
  eur: number;
  suffix?: string; // e.g. "zzgl. USt." / "zzgl. USt. / Monat"
};

export type OfferData = {
  documentTitle: string; // "Auftrag"
  dateLabel: string; // formatted date
  customerName: string;
  customerLines: string[];
  deliverable: string; // DAS BEKOMMEN SIE
  priceItems: OfferPriceItem[];
  termLine: string | null; // START & LAUFZEIT body
  logoSrc?: string;
  sender?: typeof KRILEO_SENDER;
};

export function OfferDocument({ data }: { data: OfferData }) {
  const sender = data.sender ?? KRILEO_SENDER;
  const footerParts = [
    sender.name,
    sender.owner,
    sender.addressLine,
    sender.contact,
    sender.vatId ? `USt-IdNr. ${sender.vatId}` : "",
  ].filter(Boolean);

  return (
    <Document title={`${data.documentTitle} — ${data.customerName}`} author={sender.name}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {data.logoSrc && <Image src={data.logoSrc} style={styles.logo} />}
            <Text style={styles.brandName}>{sender.name}</Text>
          </View>
          <Text style={styles.slogan}>{sender.slogan}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{data.documentTitle}</Text>
        <View style={styles.titleRule} />

        {/* Meta */}
        <View style={styles.meta}>
          <View style={styles.metaCol}>
            <Text style={styles.label}>Kunde</Text>
            <Text style={styles.metaName}>{data.customerName}</Text>
            {data.customerLines.map((l, i) => (
              <Text key={i} style={styles.metaLine}>
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.label}>Datum</Text>
            <Text style={styles.metaName}>{data.dateLabel}</Text>
          </View>
        </View>

        {/* Das bekommen Sie */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Das bekommen Sie</Text>
          <Text style={styles.bodyText}>{data.deliverable}</Text>
        </View>

        {/* Ihre Investition */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ihre Investition</Text>
          <View style={styles.panel}>
            {data.priceItems.map((it, i) => (
              <View key={i} style={styles.priceRow}>
                <Text style={styles.priceLabel}>{it.label}</Text>
                <View style={styles.priceValueWrap}>
                  <Text style={styles.priceValue}>{fmtEuro(it.eur)}</Text>
                  {it.suffix && (
                    <Text style={styles.priceSuffix}>{it.suffix}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Start & Laufzeit */}
        {data.termLine && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Start & Laufzeit</Text>
            <Text style={styles.bodyText}>{data.termLine}</Text>
          </View>
        )}

        {/* Fineprint */}
        <Text style={styles.fineprint}>
          Dies ist ein unverbindliches Angebot. Es gelten die Allgemeinen
          Geschäftsbedingungen sowie der Auftragsverarbeitungsvertrag nach Art.
          28 DSGVO. Mit der Unterschrift bestätigt der Kunde, diese erhalten zu
          haben und anzuerkennen.
        </Text>

        {/* Signatures */}
        <View style={styles.signatures}>
          <View style={styles.sigCol}>
            <View style={styles.sigLine} />
            <Text style={styles.sigCaption}>Ort, Datum · Unterschrift Kunde</Text>
            <Text style={styles.sigSub}>{data.customerName}</Text>
          </View>
          <View style={styles.sigCol}>
            <View style={styles.sigLine} />
            <Text style={styles.sigCaption}>
              Ort, Datum · Unterschrift Anbieter
            </Text>
            <Text style={styles.sigSub}>{sender.name}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          {footerParts.join("  ·  ")}
        </Text>
      </Page>
    </Document>
  );
}
