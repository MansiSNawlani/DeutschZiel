import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Bands, type Tone, TotalRow } from '@/components/feedback-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  type SchreibenCriterion,
  type SprechenCriterion,
  schreibenMax,
  sprechenMax,
} from '@/lib/bewertung';
import {
  type CriterionLine,
  type JournalAttempt,
  type SectionItem,
  entryTotal,
  isLegacy,
  knownCriterion,
  sectionItems,
} from '@/lib/history';
import { categoryLabel } from '@/lib/taxonomy';

/**
 * Every string here comes from a file on disk, which can be edited by hand. It
 * is only ever rendered as Text children, never as markup.
 */

/** Section headings as the live Feedback screens name them. */
const HEADINGS: Record<string, string> = {
  Submission: 'DEINE ANTWORT',
  Transcript: 'WAS DAS MODELL GEHÖRT HAT',
  Folien: 'FOLIEN',
  Correct: 'CORRECT',
  Simpler: 'SIMPLER',
  'More advanced': 'MORE ADVANCED',
  Mistakes: 'MISTAKES',
  'Better phrasings': 'BETTER PHRASINGS',
  Summary: 'SUMMARY',
};

const TONES: Record<string, Tone> = {
  Transcript: 'warning',
  Correct: 'success',
  Simpler: 'primary',
  'More advanced': 'accent',
  Mistakes: 'danger',
};

/** The maximum for a criterion this Attempt's skill can score, or null for a name bewertung.ts does not know. */
function criterionMax(attempt: JournalAttempt, criterion: string): number | null {
  if (!knownCriterion(attempt, criterion)) return null;
  if (attempt.skill === 'sprechen') return sprechenMax(criterion as SprechenCriterion);
  return attempt.teil ? schreibenMax(attempt.teil, criterion as SchreibenCriterion) : null;
}

/** A criterion's score on whichever scale the Attempt was written in. */
/**
 * Back to wherever the learner came from, keeping that screen's place. A page
 * opened from a pasted link has nothing to go back to, so it opens Verlauf.
 */
export function BackLink() {
  const router = useRouter();
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/verlauf'))}>
      <ThemedText type="linkPrimary">← Zurück</ThemedText>
    </Pressable>
  );
}

export function CriterionValue({
  attempt,
  line,
}: {
  attempt: JournalAttempt;
  line?: CriterionLine;
}) {
  if (!line) {
    return (
      <ThemedText type="code" themeColor="textSecondary">
        -
      </ThemedText>
    );
  }
  if (line.scale === 'band') {
    const max = criterionMax(attempt, line.criterion);
    if (max !== null) return <Bands band={line.band} max={max} />;
    return <ThemedText type="code">{line.band}</ThemedText>;
  }
  if (line.scale === 'legacy') {
    return (
      <ThemedText type="code" themeColor="textSecondary">
        {line.score}/3
      </ThemedText>
    );
  }
  return null;
}

export function EntryView({ attempt }: { attempt: JournalAttempt }) {
  const theme = useTheme();
  const total = entryTotal(attempt);
  const teil2 = attempt.criteria.filter(
    (c) => c.scale === 'unknown' || c.criterion !== 'Aussprache',
  );
  const aussprache = attempt.criteria.find(
    (c) => c.scale !== 'unknown' && c.criterion === 'Aussprache',
  );

  const criteria = attempt.criteria.length > 0 && (
    <Card title="BEWERTUNG" tone="primary">
      {isLegacy(attempt) && (
        <ThemedText type="small" themeColor="textSecondary">
          Scored on the old 0-3 scale, before the official A-E bands. It cannot be converted to a
          letter, so it is shown as it was written.
        </ThemedText>
      )}
      {teil2.map((line, i) => (
        <CriterionBlock key={i} attempt={attempt} line={line} />
      ))}
      {total && (
        <TotalRow
          label={attempt.skill === 'sprechen' ? 'Teil 2' : `Aufgabe ${attempt.teil}`}
          total={total}
        />
      )}
      {aussprache && (
        <View style={[styles.apart, { borderTopColor: theme.border }]}>
          <CriterionBlock attempt={attempt} line={aussprache} />
          <ThemedText type="small" themeColor="textSecondary">
            Scored once for the whole Sprechen Module (Teil 1-3), so it is not part of the Teil 2
            total.
          </ThemedText>
        </View>
      )}
    </Card>
  );
  const sections = attempt.sections.map((s) => (
    <Card
      key={s.heading}
      title={HEADINGS[s.heading] ?? s.heading.toUpperCase()}
      tone={TONES[s.heading]}>
      {sectionItems(s.heading, s.body).map((item, i) => (
        <Item key={i} item={item} />
      ))}
    </Card>
  ));

  // The Criteria card goes where the file put it: after the Submission, or after the Folien.
  return (
    <View style={styles.root}>
      {attempt.intro !== '' && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small">{attempt.intro}</ThemedText>
        </ThemedView>
      )}

      {sections.slice(0, attempt.criteriaAt)}
      {criteria}
      {sections.slice(attempt.criteriaAt)}
    </View>
  );
}

function CriterionBlock({ attempt, line }: { attempt: JournalAttempt; line: CriterionLine }) {
  if (line.scale === 'unknown') {
    return <ThemedText type="small">{line.raw}</ThemedText>;
  }
  return (
    <View style={styles.criterion}>
      <View style={styles.head}>
        <ThemedText type="smallBold">{line.criterion}</ThemedText>
        <CriterionValue attempt={attempt} line={line} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {line.comment}
      </ThemedText>
    </View>
  );
}

function Item({ item }: { item: SectionItem }) {
  switch (item.kind) {
    case 'mistake':
      return (
        <View style={styles.criterion}>
          <ThemedText type="small" themeColor="textSecondary">
            {categoryLabel(item.category)}
          </ThemedText>
          <ThemedText type="small">
            <ThemedText type="small" themeColor="danger" style={styles.struck}>
              {item.wrote}
            </ThemedText>
            {'  →  '}
            <ThemedText type="smallBold" themeColor="success">
              {item.correction}
            </ThemedText>
          </ThemedText>
          {item.explanation !== '' && <ThemedText type="small">{item.explanation}</ThemedText>}
        </View>
      );
    case 'folie':
      return (
        <View style={styles.criterion}>
          <ThemedText type="smallBold" themeColor={item.covered ? 'success' : 'danger'}>
            {item.covered ? '✓' : '✗'} Folie {item.folie}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.comment}
          </ThemedText>
        </View>
      );
    case 'phrasing':
      return (
        <View style={styles.criterion}>
          <ThemedText type="small">
            <ThemedText type="small" themeColor="textSecondary">
              {item.said}
            </ThemedText>
            {'  →  '}
            <ThemedText type="smallBold" themeColor="success">
              {item.better}
            </ThemedText>
          </ThemedText>
          {item.why !== '' && (
            <ThemedText type="small" themeColor="textSecondary">
              {item.why}
            </ThemedText>
          )}
        </View>
      );
    default:
      return <ThemedText type="default">{item.text}</ThemedText>;
  }
}

export function Card({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: Tone;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        styles.edged,
        {
          borderColor: theme.border,
          borderLeftColor: tone ? theme[tone] : theme.border,
        },
      ]}>
      <ThemedText type="smallBold" themeColor={tone ?? 'textSecondary'} style={styles.title}>
        {title}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three, alignSelf: 'stretch' },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  edged: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
  title: { letterSpacing: 1 },
  criterion: { gap: Spacing.half },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  apart: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  struck: { textDecorationLine: 'line-through' },
});
