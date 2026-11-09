/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from "@react-pdf/renderer";
import {
  pdfWeight as w,
  invoiceStyles as inv,
  NAVY,
  BRAND,
  FG,
  MUTED,
  FAINT,
  HAIRLINE,
  PAD,
  ON_DARK_LABEL,
  ON_DARK_TEXT,
  ON_DARK_KICK,
  WHITE,
  PAGE_W,
} from "@/lib/invoice/document";
import { fmtMoney, type IssuerSettings } from "@/lib/invoice/types";
import { contractSections, dateDE, type ContractState } from "@/lib/contract/types";

const monthsShort = (n: number) => (n === 1 ? "1 Monat" : `${n} Monate`);

// Shorter version of the invoice's gradient band: brand + title + number.
const CUT_LEFT = 150;
const CUT_RIGHT = 122;
const HEADER_SPACE = CUT_LEFT + 18;
const TOP = 44;

const s = StyleSheet.create({
  // paddingTop gives follow-up pages a top margin. Absolute children sit on the
  // paper edge, so the band stays full-bleed; only the flow spacer shrinks.
  page: { paddingTop: TOP, paddingBottom: 97, fontSize: 9.5, color: FG, lineHeight: 1.5, ...w(400) },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: HEADER_SPACE },
  bandSvg: { position: "absolute", top: 0, left: 0, width: PAGE_W, height: HEADER_SPACE },
  logoWrap: { position: "absolute", top: 22, left: 0, right: 0, alignItems: "center" },
  logo: { width: 50, height: 59 },
  titleBox: { position: "absolute", left: PAD, top: 40, width: 220 },
  kicker: { fontSize: 7.5, color: ON_DARK_KICK, letterSpacing: 2, marginBottom: 4, ...w(600) },
  title: { fontSize: 17, color: WHITE, ...w(700) },
  numBox: { position: "absolute", right: PAD, top: 40, alignItems: "flex-end" },
  numLabel: { fontSize: 7.5, color: ON_DARK_KICK, letterSpacing: 2, marginBottom: 4, ...w(600) },
  num: { fontSize: 12, color: WHITE, ...w(700) },
  subject: { position: "absolute", left: PAD, top: 92, width: 300 },
  subjectText: { fontSize: 9, color: ON_DARK_TEXT },
  subjectLabel: { fontSize: 7, color: ON_DARK_LABEL, letterSpacing: 1.2, ...w(600) },

  body: { paddingHorizontal: PAD },
  parties: { flexDirection: "row", gap: 24, marginBottom: 14 },
  party: { flex: 1, paddingLeft: 9, borderLeftWidth: 1.5, borderLeftColor: BRAND },
  partyLabel: {
    fontSize: 7, color: FAINT, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3, ...w(600),
  },
  partyName: { fontSize: 10.5, color: FG, marginBottom: 1, ...w(600) },
  partyLine: { fontSize: 9, color: MUTED },

  meta: {
    flexDirection: "row", paddingVertical: 6, borderTopWidth: 0.75, borderBottomWidth: 0.75,
    borderColor: HAIRLINE, marginBottom: 14,
  },
  metaCol: { flex: 1, alignItems: "center" },
  metaLabel: {
    fontSize: 6.5, color: FAINT, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2, ...w(500),
  },
  metaValue: { fontSize: 10, color: FG, ...w(600) },

  section: { marginBottom: 9 },
  secTitle: { fontSize: 10, color: NAVY, marginBottom: 3, ...w(700) },
  para: { fontSize: 9.5, color: FG, marginBottom: 3 },
  bullet: { flexDirection: "row", marginBottom: 2, paddingLeft: 4 },
  bulletDot: { width: 10, fontSize: 9.5, color: BRAND, ...w(700) },
  bulletText: { flex: 1, fontSize: 9.5, color: FG },

  signRow: { flexDirection: "row", gap: 36, marginTop: 26 },
  signCol: { flex: 1 },
  signSpace: { height: 34, borderBottomWidth: 0.75, borderBottomColor: FG },
  signLabel: { fontSize: 7.5, color: MUTED, marginTop: 3 },
  signName: { fontSize: 8.5, color: FG, marginTop: 1, ...w(600) },
});

export type ContractData = {
  contract: ContractState;
  issuer: IssuerSettings;
  issuerAddressLines: string[];
  recipientLines: string[];
  logoSrc?: string;
  logoStackSrc?: string;
};

export function ContractDocument({ data }: { data: ContractData }) {
  const c = data.contract;
  const money = (cents: number) => fmtMoney(cents, c.currency);
  const startDE = c.start ? dateDE(`${c.start}T12:00:00`) : "—";
  const signedDE = dateDE(c.date);
  const sections = contractSections(c, money, data.issuer.brandName || "Krileo");
  const recipientTitle = c.recipient.company || c.recipient.name;

  const gradPath =
    `M 0,0 L ${PAGE_W},0 L ${PAGE_W},${CUT_RIGHT} L 0,${CUT_LEFT} Z`;

  return (
    <Document title={`Servicevertrag ${c.number}`} author={data.issuer.senderName}>
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed={false}>
          <Svg style={s.bandSvg} viewBox={`0 0 ${PAGE_W} ${HEADER_SPACE}`}>
            <Defs>
              <LinearGradient id="cg" x1="0" y1="0" x2={PAGE_W} y2={HEADER_SPACE} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#0A1D39" />
                <Stop offset="0.55" stopColor="#123B6E" />
                <Stop offset="1" stopColor="#1E5EA6" />
              </LinearGradient>
            </Defs>
            <Path d={gradPath} fill="url(#cg)" />
          </Svg>
          {data.logoStackSrc ? (
            <View style={s.logoWrap}>
              <Image src={data.logoStackSrc} style={s.logo} />
            </View>
          ) : null}
          <View style={s.titleBox}>
            <Text style={s.kicker}>VERTRAG · SERVICE</Text>
            <Text style={s.title}>Servicevertrag</Text>
          </View>
          <View style={s.numBox}>
            <Text style={s.numLabel}>VERTRAGSNUMMER</Text>
            <Text style={s.num}>{c.number}</Text>
          </View>
          <View style={s.subject}>
            <Text style={s.subjectText}>{c.title}</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={{ height: HEADER_SPACE - TOP }} />

          <View style={s.parties}>
            <View style={s.party}>
              <Text style={s.partyLabel}>Auftraggeber</Text>
              <Text style={s.partyName}>{recipientTitle}</Text>
              {c.recipient.company && c.recipient.name ? (
                <Text style={s.partyLine}>vertreten durch {c.recipient.name}</Text>
              ) : null}
              {data.recipientLines.map((l, i) => (
                <Text key={i} style={s.partyLine}>{l}</Text>
              ))}
            </View>
            <View style={s.party}>
              <Text style={s.partyLabel}>Auftragnehmer</Text>
              <Text style={s.partyName}>{data.issuer.senderName}</Text>
              <Text style={s.partyLine}>{data.issuer.brandName} · {data.issuer.footerNote}</Text>
              {data.issuerAddressLines.map((l, i) => (
                <Text key={i} style={s.partyLine}>{l}</Text>
              ))}
            </View>
          </View>

          <View style={s.meta}>
            {[
              ["Vertragsbeginn", startDE],
              ["Vergütung", `${money(c.monthlyCents)} / Monat`],
              ["Mindestlaufzeit", monthsShort(c.minTermMonths)],
              ["Kündigungsfrist", `${monthsShort(c.noticeMonths)} z. Monatsende`],
            ].map(([label, value]) => (
              <View key={label} style={s.metaCol}>
                <Text style={s.metaLabel}>{label}</Text>
                <Text style={s.metaValue}>{value}</Text>
              </View>
            ))}
          </View>

          {sections.map((sec, i) => (
            <View key={i} style={s.section} wrap={false}>
              <Text style={s.secTitle}>
                § {i + 1} {sec.title}
              </Text>
              {sec.paragraphs.slice(0, 1).map((p, j) => (
                <Text key={`p${j}`} style={s.para}>{p}</Text>
              ))}
              {sec.bullets?.map((b, j) => (
                <View key={`b${j}`} style={s.bullet}>
                  <Text style={s.bulletDot}>·</Text>
                  <Text style={s.bulletText}>{b}</Text>
                </View>
              ))}
              {sec.paragraphs.slice(1).map((p, j) => (
                <Text key={`q${j}`} style={[s.para, sec.bullets ? { marginTop: 3 } : {}]}>{p}</Text>
              ))}
            </View>
          ))}

          <View style={s.signRow} wrap={false}>
            <View style={s.signCol}>
              <View style={s.signSpace} />
              <Text style={s.signLabel}>Ort, Datum · Auftraggeber</Text>
              <Text style={s.signName}>{recipientTitle}</Text>
            </View>
            <View style={s.signCol}>
              <View style={s.signSpace} />
              <Text style={s.signLabel}>Aichtal, {signedDE} · Auftragnehmer</Text>
              <Text style={s.signName}>{data.issuer.senderName}</Text>
            </View>
          </View>
        </View>

        <View style={inv.footer} fixed>
          <View style={inv.footCell}>
            <Text style={inv.footStrong}>{data.issuer.gf}</Text>
            <Text style={inv.footLine}>{data.issuer.email}</Text>
            {data.issuer.email2 ? <Text style={inv.footLine}>{data.issuer.email2}</Text> : null}
          </View>
          <View style={inv.footCenterCell}>
            {data.logoSrc ? <Image src={data.logoSrc} style={inv.footLogo} /> : null}
            <Text style={inv.footCenter}>{data.issuer.footerNote.toUpperCase()}</Text>
          </View>
          <View style={inv.footCell}>
            <Text style={[inv.footStrong, inv.footRight]}>Krileo · Service</Text>
            <Text style={[inv.footLine, inv.footRight]}>{data.issuer.phone}</Text>
            {data.issuer.phone2 ? (
              <Text style={[inv.footLine, inv.footRight]}>{data.issuer.phone2}</Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
