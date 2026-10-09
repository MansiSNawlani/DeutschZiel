import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackLink, Card, CriterionValue } from '@/components/history-view';
import { JournalStatus, Notice } from '@/components/journal-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useJournal } from '@/hooks/use-journal';
import { useTheme } from '@/hooks/use-theme';
import { SCHREIBEN_CRITERIA, SPRECHEN_CRITERIA, type Total, formatPoints } from '@/lib/bewertung';
import {
  type JournalAttempt,
  compareCategories,
  entryEffort,
  entryTotal,
  formatDate,
  formatDay,
  isLegacy,
  parseAll,
  routeParam,
  sameTask,
  taskGroup,
  taskKey,
} from '@/lib/history';
import { readAttemptFiles } from '@/lib/journal';
import { categoryLabel } from '@/lib/taxonomy';

type Comparison =
  /** `group` is every Attempt on the Task, oldest first; `first` is group[0]. */
  | {
      ok: true;
      first: JournalAttempt;
      later: JournalAttempt;
      group: JournalAttempt[];
    }
  | { ok: false; reason: string };

export default function VergleichScreen() {
  const params = useLocalSearchParams<{
    erst?: string | string[];
    spaeter?: string | string[];
  }>();
  const erst = routeParam(params.erst);
  const spaeter = routeParam(params.spaeter);

  const read = useCallback(async (): Promise<Comparison | null> => {
    const files = await readAttemptFiles();
    if (!files) return null;
    const { attempts } = parseAll(files.files);
    const first = attempts.find((a) => a.file === erst);
    const later = attempts.find((a) => a.file === spaeter);
    if (!first || !later) {
      return {
        ok: false,
        reason:
          'One of the two Attempts is not in the journal folder any more, or could not be read.',
      };
    }
    const group = taskGroup(attempts, erst);
    // The first Attempt stays fixed, so it has to be the oldest one on the Task.
    if (
      !sameTask(taskKey(erst), taskKey(spaeter)) ||
      group[0] !== first ||
      group.indexOf(later) < 1
    ) {
      return {
        ok: false,
        reason:
          'These two files are not the first and a later Attempt on the same Task, so there is nothing to compare.',
      };
    }
    return { ok: true, first, later, group };
  }, [erst, spaeter]);
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
            noFolderText="Choose your journal/ folder in Einstellungen to compare past Attempts here."
          />

          {phase === 'ready' && data && !data.ok && (
            <Notice title="Kein Vergleich möglich">{data.reason}</Notice>
          )}
          {phase === 'ready' && data?.ok && <Compare comparison={data} />}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Compare({
  comparison: { first, later, group },
}: {
  comparison: Extract<Comparison, { ok: true }>;
}) {
  const theme = useTheme();
  const names: string[] = [
    ...(first.skill === 'sprechen' ? SPRECHEN_CRITERIA : SCHREIBEN_CRITERIA),
  ];
  const lineOf = (attempt: JournalAttempt, name: string) =>
    attempt.criteria.find((c) => c.scale !== 'unknown' && c.criterion === name);
  const { gone, still, added } = compareCategories(first.categories, later.categories);
  const firstTotal = entryTotal(first);
  const laterTotal = entryTotal(later);
  const legacy = isLegacy(first) || isLegacy(later);
  const textHeading = first.skill === 'sprechen' ? 'Transcript' : 'Submission';
  const textOf = (attempt: JournalAttempt) =>
    attempt.sections.find((s) => s.heading === textHeading)?.body ?? '';
  const attemptNo = (attempt: JournalAttempt) => group.indexOf(attempt) + 1;
  const laterOptions = group.slice(1);

  return (
    <>
      <View style={styles.header}>
        <ThemedText type="subtitle">{later.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Versuch 1 vom {formatDate(first.date)} gegen Versuch {attemptNo(later)} vom{' '}
          {formatDate(later.date)}
        </ThemedText>
      </View>

      {laterOptions.length > 1 && (
        <View style={styles.chips}>
          <ThemedText type="small" themeColor="textSecondary">
            Versuch 1 vergleichen mit:
          </ThemedText>
          {laterOptions.map((option) => {
            const selected = option.file === later.file;
            return (
              <Link
                key={option.file}
                href={{
                  pathname: '/vergleich',
                  params: { erst: first.file, spaeter: option.file },
                }}
                replace
                asChild>
                {/* Link asChild clones props onto the child, so the style must be flat. */}
                <Pressable
                  style={StyleSheet.flatten([
                    styles.chip,
                    { backgroundColor: selected ? theme.primary : theme.primarySoft },
                  ])}>
                  <ThemedText
                    type="smallBold"
                    style={selected ? styles.onPrimary : { color: theme.primary }}>
                    Versuch {attemptNo(option)} · {formatDay(option.date)}
                  </ThemedText>
                </Pressable>
              </Link>
            );
          })}
        </View>
      )}

      <Card title="BEWERTUNG" tone="primary">
        {legacy && (
          <ThemedText type="small" themeColor="textSecondary">
            An Attempt on the old 0-3 scale is shown as it was written. It cannot be converted to an
            A-E band, so it has no total to compare.
          </ThemedText>
        )}
        <View style={styles.compareRow}>
          <View style={styles.name} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
            Versuch 1 · {formatDay(first.date)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
            Versuch {attemptNo(later)} · {formatDay(later.date)}
          </ThemedText>
        </View>
        {names.map((name) => (
          <View
            key={name}
            style={[styles.compareRow, { borderTopColor: theme.border }, styles.ruled]}>
            <ThemedText type="smallBold" style={styles.name}>
              {name}
            </ThemedText>
            <View style={styles.value}>
              <CriterionValue attempt={first} line={lineOf(first, name)} />
            </View>
            <View style={styles.value}>
              <CriterionValue attempt={later} line={lineOf(later, name)} />
            </View>
          </View>
        ))}
        <View style={[styles.compareRow, { borderTopColor: theme.border }, styles.ruled]}>
          <ThemedText type="smallBold" style={styles.name}>
            {first.skill === 'sprechen' ? 'Teil 2' : `Aufgabe ${first.teil ?? ''}`}
          </ThemedText>
          <TotalText total={firstTotal} />
          <TotalText total={laterTotal} />
        </View>
        <View style={styles.compareRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.name}>
            Umfang
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
            {entryEffort(first).join(' · ')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
            {entryEffort(later).join(' · ')}
          </ThemedText>
        </View>
      </Card>

      <Card title="FEHLERKATEGORIEN" tone="primary">
        <CategoryGroup
          title="Weg"
          tone="success"
          hint="in Versuch 1, not any more"
          categories={gone}
        />
        <CategoryGroup title="Noch da" tone="warning" hint="in both" categories={still} />
        <CategoryGroup
          title="Neu"
          tone="danger"
          hint="only in the later Attempt"
          categories={added}
        />
      </Card>

      <Collapsible title={`${textHeading}, Versuch 1`}>
        <ThemedText type="default">{textOf(first) || '-'}</ThemedText>
      </Collapsible>
      <Collapsible title={`${textHeading}, Versuch ${attemptNo(later)}`}>
        <ThemedText type="default">{textOf(later) || '-'}</ThemedText>
      </Collapsible>

      <View style={styles.links}>
        <Link href={{ pathname: '/versuch', params: { datei: first.file } }} asChild>
          <Pressable>
            <ThemedText type="linkPrimary">Versuch 1 öffnen</ThemedText>
          </Pressable>
        </Link>
        <Link href={{ pathname: '/versuch', params: { datei: later.file } }} asChild>
          <Pressable>
            <ThemedText type="linkPrimary">Versuch {attemptNo(later)} öffnen</ThemedText>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

function TotalText({ total }: { total: Total | null }) {
  return (
    <ThemedText
      type="code"
      themeColor={total?.zeroed ? 'danger' : total ? 'text' : 'textSecondary'}
      style={styles.value}>
      {total ? `${formatPoints(total.points)} / ${total.max}` : '-'}
    </ThemedText>
  );
}

function CategoryGroup({
  title,
  tone,
  hint,
  categories,
}: {
  title: string;
  tone: 'success' | 'warning' | 'danger';
  hint: string;
  categories: string[];
}) {
  return (
    <View style={styles.group}>
      <ThemedText type="small">
        <ThemedText type="smallBold" themeColor={tone}>
          {title} ({categories.length})
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {'  '}
          {hint}
        </ThemedText>
      </ThemedText>
      {categories.length > 0 && (
        <ThemedText type="small">{categories.map(categoryLabel).join(' · ')}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing.three, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  header: { gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ruled: { paddingTop: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  name: { flex: 1 },
  value: { flex: 1.4 },
  group: { gap: Spacing.half },
  onPrimary: { color: '#FFFFFF' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
