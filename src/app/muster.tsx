import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { JournalStatus, Notice } from '@/components/journal-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useJournal } from '@/hooks/use-journal';
import { useTheme } from '@/hooks/use-theme';
import { readAttemptRecords } from '@/lib/journal';
import { type PatternRow, summarisePatterns } from '@/lib/patterns';
import { categoryLabel } from '@/lib/taxonomy';

type PatternSummary = { rows: PatternRow[]; attempts: number; unreadable: number };

async function readPatterns(): Promise<PatternSummary | null> {
  const read = await readAttemptRecords();
  if (!read) return null;
  const { records, unreadable } = read;
  return { rows: summarisePatterns(records), attempts: records.length, unreadable };
}

export default function MusterScreen() {
  const { phase, data: journal, error, reconnect } = useJournal(readPatterns);

  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">Fehlermuster</ThemedText>
            <View style={styles.row}>
              <Link href="/verlauf" asChild>
                <Pressable>
                  <ThemedText type="linkPrimary">Verlauf</ThemedText>
                </Pressable>
              </Link>
              <Link href="/" asChild>
                <Pressable>
                  <ThemedText type="linkPrimary">Schreiben</ThemedText>
                </Pressable>
              </Link>
              <Link href="/sprechen" asChild>
                <Pressable>
                  <ThemedText type="linkPrimary">Sprechen</ThemedText>
                </Pressable>
              </Link>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            The mistakes you keep making, across every Attempt in your journal folder, Schreiben
            and Sprechen together.
          </ThemedText>

          <JournalStatus
            phase={phase}
            error={error}
            reconnect={reconnect}
            noFolderText="Choose your journal/ folder in Einstellungen, and the patterns from every Attempt in it appear here."
          />

          {phase === 'ready' && journal && <Patterns journal={journal} />}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** How many recurring categories get a card of their own; the rest are a list. */
const FOCUS_COUNT = 3;

function Patterns({ journal }: { journal: PatternSummary }) {
  const { rows, attempts, unreadable } = journal;
  const recurring = rows.filter((r) => r.recurring);
  const focus = recurring.slice(0, FOCUS_COUNT);
  const more = recurring.slice(FOCUS_COUNT);
  const once = rows.filter((r) => !r.recurring);

  if (attempts === 0) {
    return (
      <Notice title="Noch keine Attempts">
        Nothing in the journal folder yet. Submit a Schreiben or Sprechen Attempt and its mistakes
        are counted here.
      </Notice>
    );
  }

  return (
    <>
      {unreadable > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {unreadable} file{unreadable === 1 ? '' : 's'} in the folder could not be read and{' '}
          {unreadable === 1 ? 'was' : 'were'} skipped.
        </ThemedText>
      )}

      {rows.length === 0 ? (
        <Notice title="Keine Fehler">No mistakes in any of your {attempts} Attempts so far.</Notice>
      ) : recurring.length === 0 ? (
        <Notice title="Noch kein Muster">
          No mistake has come back in a second Attempt yet. Keep practising and the ones that
          repeat will show up here.
        </Notice>
      ) : (
        <>
          <ThemedText type="smallBold">Worauf du achten solltest</ThemedText>
          {focus.map((r) => (
            <FocusCard key={r.category} row={r} attempts={attempts} />
          ))}
        </>
      )}

      {more.length > 0 && (
        <Section title="Weitere">
          {more.map((r) => (
            <View key={r.category} style={styles.listRow}>
              <ThemedText type="small">{categoryLabel(r.category)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {r.attempts} von {attempts}
              </ThemedText>
            </View>
          ))}
        </Section>
      )}

      {once.length > 0 && (
        <Section title="Nur einmal gesehen">
          <ThemedText type="small" themeColor="textSecondary">
            {once.map((r) => categoryLabel(r.category)).join(' · ')}
          </ThemedText>
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

function FocusCard({ row, attempts }: { row: PatternRow; attempts: number }) {
  const theme = useTheme();
  const tone = row.inRecent ? 'danger' : 'success';

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, styles.edged, { borderColor: theme.border, borderLeftColor: theme[tone] }]}>
      <View style={styles.listRow}>
        <ThemedText type="smallBold">{categoryLabel(row.category)}</ThemedText>
        <ThemedText type="smallBold" themeColor={tone}>
          {row.inRecent ? 'Immer wieder' : 'Zuletzt nicht mehr'}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        in {row.attempts} von {attempts} Attempts
      </ThemedText>
      {row.example && (
        <ThemedText type="small">
          <ThemedText type="small" themeColor="danger" style={styles.struck}>
            {row.example.wrote}
          </ThemedText>
          {'  →  '}
          <ThemedText type="smallBold" themeColor="success">
            {row.example.correction}
          </ThemedText>
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing.three, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  edged: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
  sectionTitle: { letterSpacing: 1 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  struck: { textDecorationLine: 'line-through' },
});
