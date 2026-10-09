import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackLink, EntryView } from '@/components/history-view';
import { JournalStatus, Notice } from '@/components/journal-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useJournal } from '@/hooks/use-journal';
import {
  type JournalAttempt,
  entryEffort,
  entryLabel,
  formatDate,
  parseJournalAttempt,
  routeParam,
} from '@/lib/history';
import { readAttemptFile } from '@/lib/journal';

export default function VersuchScreen() {
  const datei = routeParam(useLocalSearchParams<{ datei?: string | string[] }>().datei);

  // useJournal has already confirmed the folder grant, so null here means the
  // file is gone or unreadable rather than a lapsed folder.
  const read = useCallback(async (): Promise<{
    attempt: JournalAttempt | null;
  }> => {
    const text = await readAttemptFile(datei);
    return { attempt: text === null ? null : parseJournalAttempt(datei, text) };
  }, [datei]);
  const { phase, data, error, reconnect } = useJournal(read);

  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <BackLink />

          <JournalStatus
            phase={phase}
            error={error}
            reconnect={reconnect}
            noFolderText="Choose your journal/ folder in Einstellungen to read past Attempts here."
          />

          {phase === 'ready' && data && !data.attempt && (
            <Notice title="Versuch nicht gefunden">
              {datei || 'No file was named'} is not in the journal folder, or could not be read. It
              may have been moved or deleted since the list was loaded.
            </Notice>
          )}

          {phase === 'ready' && data?.attempt && (
            <>
              <View style={styles.header}>
                <ThemedText type="small" themeColor="textSecondary">
                  {[
                    formatDate(data.attempt.date),
                    entryLabel(data.attempt),
                    ...entryEffort(data.attempt),
                  ].join(' · ')}
                </ThemedText>
                <ThemedText type="subtitle">{data.attempt.title}</ThemedText>
              </View>
              <EntryView attempt={data.attempt} />
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing.three, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  header: { gap: Spacing.one },
});
