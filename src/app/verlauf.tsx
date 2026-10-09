import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { JournalStatus, Notice } from '@/components/journal-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useJournal } from '@/hooks/use-journal';
import { formatPoints } from '@/lib/bewertung';
import {
  type JournalAttempt,
  entryLabel,
  entryTotal,
  formatDate,
  isLegacy,
  parseAll,
  taskGroup,
  taskKey,
} from '@/lib/history';
import { readAttemptFiles } from '@/lib/journal';

type Row = {
  attempt: JournalAttempt;
  /** 1-based, counted from the oldest Attempt on the same Task. */
  number: number;
  of: number;
  /**
   * The first Attempt on the same Task against this one, or against the latest
   * when this one is the first. Only when the Task has two or more Attempts.
   */
  compare?: { erst: string; spaeter: string };
};

type History = { rows: Row[]; unreadable: number };

async function readHistory(): Promise<History | null> {
  const read = await readAttemptFiles();
  if (!read) return null;
  const { attempts, unparsed } = parseAll(read.files);

  const rows: Row[] = attempts.map((attempt) => {
    const group = taskKey(attempt.file) ? taskGroup(attempts, attempt.file) : [attempt];
    const index = group.indexOf(attempt);
    return {
      attempt,
      number: index + 1,
      of: group.length,
      compare:
        group.length > 1
          ? { erst: group[0].file, spaeter: (index > 0 ? attempt : group[group.length - 1]).file }
          : undefined,
    };
  });
  rows.sort((a, b) => Date.parse(b.attempt.date) - Date.parse(a.attempt.date));
  return { rows, unreadable: read.unreadable + unparsed };
}

export default function VerlaufScreen() {
  const { phase, data, error, reconnect } = useJournal(readHistory);

  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">Verlauf</ThemedText>
            <View style={styles.row}>
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
              <Link href="/muster" asChild>
                <Pressable>
                  <ThemedText type="linkPrimary">Fehlermuster</ThemedText>
                </Pressable>
              </Link>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Every Attempt in your journal folder, newest first. Open one to read its Feedback again,
            or compare a later Attempt with your first one on the same Task.
          </ThemedText>

          <JournalStatus
            phase={phase}
            error={error}
            reconnect={reconnect}
            noFolderText="Choose your journal/ folder in Einstellungen, and every Attempt in it is listed here."
          />

          {phase === 'ready' && data && <Rows history={data} />}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Rows({ history: { rows, unreadable } }: { history: History }) {
  return (
    <>
      {unreadable > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {unreadable} file{unreadable === 1 ? '' : 's'} in the folder could not be read and{' '}
          {unreadable === 1 ? 'was' : 'were'} skipped.
        </ThemedText>
      )}
      {rows.length === 0 ? (
        <Notice title="Noch keine Attempts">
          Nothing in the journal folder yet. Submit a Schreiben or Sprechen Attempt and it is listed
          here.
        </Notice>
      ) : (
        rows.map((row) => <AttemptRow key={row.attempt.file} row={row} />)
      )}
    </>
  );
}

function AttemptRow({ row: { attempt, number, of, compare } }: { row: Row }) {
  const total = entryTotal(attempt);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.listRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(attempt.date)} · {entryLabel(attempt)}
        </ThemedText>
        {total ? (
          <ThemedText type="code" themeColor={total.zeroed ? 'danger' : 'text'}>
            {formatPoints(total.points)} / {total.max}
          </ThemedText>
        ) : (
          isLegacy(attempt) && (
            <ThemedText type="small" themeColor="textSecondary">
              alte Skala
            </ThemedText>
          )
        )}
      </View>
      <ThemedText type="smallBold">{attempt.title}</ThemedText>
      <View style={styles.listRow}>
        <View style={styles.row}>
          <Link href={{ pathname: '/versuch', params: { datei: attempt.file } }} asChild>
            <Pressable>
              <ThemedText type="linkPrimary">Öffnen</ThemedText>
            </Pressable>
          </Link>
          {compare && (
            <Link href={{ pathname: '/vergleich', params: compare }} asChild>
              <Pressable>
                <ThemedText type="linkPrimary">Vergleichen</ThemedText>
              </Pressable>
            </Link>
          )}
        </View>
        {of > 1 && (
          <ThemedText type="small" themeColor="textSecondary">
            Versuch {number} von {of}
          </ThemedText>
        )}
      </View>
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
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
