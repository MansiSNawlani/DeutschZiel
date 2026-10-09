import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { JournalPhase } from '@/hooks/use-journal';
import { useTheme } from '@/hooks/use-theme';

/**
 * Everything a journal-reading screen shows before its content is ready.
 * Renders nothing in the ready phase.
 */
export function JournalStatus({
  phase,
  error,
  reconnect,
  noFolderText,
}: {
  phase: JournalPhase;
  error: string | null;
  reconnect: () => void;
  /** What appears here once a folder is chosen, for the "Kein Journal-Ordner" notice. */
  noFolderText: string;
}) {
  const theme = useTheme();

  switch (phase) {
    case 'loading':
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Lese Journal…
        </ThemedText>
      );
    case 'unsupported':
      return (
        <Notice title="Journal nicht lesbar">
          Reading the journal folder needs the File System Access API, which means Chrome or Edge.
          Attempts saved here were downloaded instead, and downloads cannot be read back.
        </Notice>
      );
    case 'none':
      return (
        <Notice
          title="Kein Journal-Ordner"
          action={
            <Link href="/settings" asChild>
              <Pressable>
                <ThemedText type="linkPrimary">Einstellungen öffnen →</ThemedText>
              </Pressable>
            </Link>
          }>
          {noFolderText}
        </Notice>
      );
    case 'needs-permission':
      return (
        <Notice
          title="Zugriff erneuern"
          action={
            <Pressable
              onPress={reconnect}
              style={[styles.button, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={styles.onPrimary}>
                Journal verbinden
              </ThemedText>
            </Pressable>
          }>
          The browser asks again for access to the journal folder after a reload.
        </Notice>
      );
    case 'error':
      return (
        <Notice title="Fehler beim Lesen" tone="danger">
          {error}
        </Notice>
      );
    default:
      return null;
  }
}

export function Notice({
  title,
  tone,
  action,
  children,
}: {
  title: string;
  tone?: 'danger';
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        tone && [styles.edged, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }],
      ]}>
      <ThemedText type="smallBold" themeColor={tone}>
        {title}
      </ThemedText>
      <ThemedText type="small">{children}</ThemedText>
      {action}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  edged: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  onPrimary: { color: '#FFFFFF' },
});
