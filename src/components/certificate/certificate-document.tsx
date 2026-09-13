import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  resolveBody,
  imageSrc,
  DEFAULT_TITLE,
  DEFAULT_PRIMARY_COLOR,
  type CertificateConfigLike,
  type CertificateEventInfo,
} from '@/lib/certificate';
import { cursiveFontSize, registerSignatureFonts, signatureFontFamily } from '@/lib/certificate-fonts';

export interface CertificateDocumentProps {
  config: CertificateConfigLike;
  event: CertificateEventInfo;
  certificate: { code: string; name: string };
  verifyUrl: string;
  qrDataUrl: string;
  /** true when rendering in a route handler (images fetched directly, no proxy) */
  server?: boolean;
}

// A4 landscape: 841.89 x 595.28 pt
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 841.89,
    height: 595.28,
  },
  // Default double-line frame, drawn only when there is no background image.
  frameOuter: { position: 'absolute', top: 18, left: 18, right: 18, bottom: 18, borderWidth: 3 },
  frameInner: { position: 'absolute', top: 26, left: 26, right: 26, bottom: 26, borderWidth: 1 },
  content: { flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 60 },
  // react-pdf only honours max* on images when a box is given; fix the box and fit inside it.
  logo: { width: 200, height: 60, objectFit: 'contain', objectPosition: 'left' },
  issuer: { fontSize: 12, color: '#475569' },
  main: { alignItems: 'center', paddingHorizontal: 40 },
  title: { fontSize: 30, fontFamily: 'Helvetica-Bold', marginBottom: 18, textAlign: 'center' },
  name: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 14, textAlign: 'center' },
  body: { fontSize: 13, lineHeight: 1.6, color: '#1e293b', textAlign: 'center', maxWidth: 640 },
  sponsorsBlock: { alignItems: 'center', marginTop: 10 },
  sponsorsLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  sponsorsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  sponsorLogo: { height: 32, maxWidth: 90, objectFit: 'contain' },
  signaturesRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 10 },
  // 5 slots (4 org + participant) only fit the 761pt content width with narrower boxes and gap:
  // 5 × 130 + 4 × 24 = 746.
  signaturesRowCompact: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 10 },
  signature: { width: 150, alignItems: 'center' },
  signatureCompact: { width: 130, alignItems: 'center' },
  // Fixed-height box above the line, shared by every slot (image, typed text or empty),
  // so all signature lines sit at the same height regardless of what fills them.
  signatureBox: { height: 44, marginBottom: 4, justifyContent: 'flex-end', alignItems: 'center' },
  signatureImage: { height: 40, maxWidth: 140, objectFit: 'contain' },
  // fontSize comes from cursiveFontSize() (scaled to the slot); maxLines is only a last resort.
  signatureTextValue: { color: '#0f172a', textAlign: 'center', maxLines: 1, textOverflow: 'ellipsis' },
  signatureLine: { width: 140, borderTopWidth: 1, borderTopColor: '#94a3b8', marginBottom: 4 },
  signatureLineCompact: { width: 120, borderTopWidth: 1, borderTopColor: '#94a3b8', marginBottom: 4 },
  signatureName: { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  signatureRole: { fontSize: 9, color: '#64748b', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerText: { fontSize: 8, color: '#64748b' },
  code: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 2 },
  qr: { width: 56, height: 56 },
});

// A signature is one line: never break words, truncate with an ellipsis instead.
const keepWordWhole = (word: string) => [word];

export function CertificateDocument({
  config,
  event,
  certificate,
  verifyUrl,
  qrDataUrl,
  server = false,
}: CertificateDocumentProps) {
  // Idempotent: registers the cursive fonts once per process (server) or page (browser).
  registerSignatureFonts({ server });
  const primary = config.primary_color || DEFAULT_PRIMARY_COLOR;
  const title = config.title?.trim() || DEFAULT_TITLE;
  const body = resolveBody(config, event, certificate.name);
  const src = (url?: string | null) => imageSrc(url, { server });
  const sponsors = (config.sponsors || []).filter((s) => s.logo);
  const signatures = (config.signatures || []).slice(0, 4);
  // The participant always gets a blank line to sign, at the right of the org signatures.
  // Slot priority: image → typed cursive text → blank spacer.
  const slots = [
    ...signatures.map((s) => ({
      name: s.name,
      role: s.role ?? null,
      image: s.image ?? null,
      text: s.text?.trim() || null,
      fontFamily: signatureFontFamily(s.font),
    })),
    { name: certificate.name, role: 'Participante', image: null, text: null, fontFamily: '' },
  ];
  const compact = slots.length > 4;

  return (
    <Document title={`${title} - ${certificate.name}`} author={config.issuer_name || 'Hub Community'}>
      <Page size="A4" orientation="landscape" wrap={false} style={styles.page}>
        {config.background ? (
          <Image src={src(config.background)!} style={styles.background} />
        ) : (
          <>
            <View style={[styles.frameOuter, { borderColor: primary }]} />
            <View style={[styles.frameInner, { borderColor: primary }]} />
          </>
        )}

        <View style={styles.content}>
          <View style={styles.header}>
            {config.logo ? <Image src={src(config.logo)!} style={styles.logo} /> : <View />}
            {config.issuer_name ? <Text style={styles.issuer}>{config.issuer_name}</Text> : null}
          </View>

          <View style={styles.main}>
            <Text style={[styles.title, { color: primary }]}>{title}</Text>
            <Text style={styles.name}>{certificate.name}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>

          {sponsors.length > 0 ? (
            <View style={styles.sponsorsBlock}>
              <Text style={styles.sponsorsLabel}>Patrocínio</Text>
              <View style={styles.sponsorsRow}>
                {sponsors.map((s, i) => (
                  <Image key={`${s.name}-${i}`} src={src(s.logo)!} style={styles.sponsorLogo} />
                ))}
              </View>
            </View>
          ) : null}

          <View style={compact ? styles.signaturesRowCompact : styles.signaturesRow}>
            {slots.map((slot, i) => (
              <View key={`${slot.name}-${i}`} style={compact ? styles.signatureCompact : styles.signature}>
                <View style={styles.signatureBox}>
                  {slot.image ? (
                    <Image src={src(slot.image)!} style={styles.signatureImage} />
                  ) : slot.text ? (
                    <Text
                      style={[
                        styles.signatureTextValue,
                        { fontFamily: slot.fontFamily, fontSize: cursiveFontSize(slot.text, compact) },
                      ]}
                      hyphenationCallback={keepWordWhole}
                    >
                      {slot.text}
                    </Text>
                  ) : null}
                </View>
                <View style={compact ? styles.signatureLineCompact : styles.signatureLine} />
                <Text style={styles.signatureName}>{slot.name}</Text>
                {slot.role ? <Text style={styles.signatureRole}>{slot.role}</Text> : null}
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <View>
              <Text style={styles.code}>Código: {certificate.code}</Text>
              <Text style={styles.footerText}>Verifique a autenticidade em {verifyUrl}</Text>
            </View>
            <Image src={qrDataUrl} style={styles.qr} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default CertificateDocument;
