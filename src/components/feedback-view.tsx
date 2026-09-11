import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ERROR_GROUPS, categoryById } from '@/lib/taxonomy';
import type { Feedback, Task } from '@/lib/types';
import { aboveB1 } from '@/lib/wortliste';

const BAND_MAX = 3;

/**
 * Criteria first, rewrites second. With five weeks to an exam the band scores
 * are what show where marks are actually leaking; the tiered rewrite is the
 * better long-term learning artifact but the slower one to act on.
 *
 * Colour carries the meaning here — see the palette note in constants/theme.ts.
 * A learner should be able to tell a full band from a failing one, and the
 * Correct tier from the More advanced one, without reading a word.
 */
export function FeedbackView({ feedback, task }: { feedback: Feedback; task: Task }) {
  return (
    <View style={styles.root}>
      <Section title="Bewertung" tone="primary">
        {feedback.criteria.map((c) => (
          <View key={c.criterion} style={styles.criterion}>
            <View style={styles.criterionHead}>
              <ThemedText type="smallBold">{c.criterion}</ThemedText>
              <Bands band={c.band} />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {c.comment}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={styles.caveat}>
          Bands are an approximation of the official Bewertungskriterien, not the real thing. Check
          them against the Modellsatz.
        </ThemedText>
      </Section>

      <Tier
        label="Correct"
        hint="your text, minimally repaired"
        text={feedback.tiers.correct}
        tone="success"
      />
      <Tier
        label="Simpler"
        hint="how a confident B1 speaker would say it"
        text={feedback.tiers.simpler}
        tone="primary"
      />
      <Tier
        label="More advanced"
        hint="deliberately above B1 — a stretch, not the expected answer"
        text={feedback.tiers.advanced}
        tone="accent"
      />

      <Section
        title={`Fehler (${feedback.mistakes.length})`}
        tone={feedback.mistakes.length ? 'danger' : 'success'}>
        {feedback.mistakes.length === 0 ? (
          <ThemedText type="small" themeColor="success">
            Keine Fehler gefunden.
          </ThemedText>
        ) : (
          feedback.mistakes.map((m, i) => <Mistake key={`${m.category}-${i}`} mistake={m} />)
        )}
      </Section>

      <Section title="Nächstes Mal" tone="primary">
        <ThemedText type="small">{feedback.summary}</ThemedText>
      </Section>

      <OutsideWortliste feedback={feedback} task={task} />
    </View>
  );
}

function Mistake({ mistake }: { mistake: Feedback['mistakes'][number] }) {
  const theme = useTheme();
  const category = categoryById(mistake.category);

  return (
    <View style={[styles.mistake, { borderTopColor: theme.border }]}>
      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: theme.dangerSoft }]}>
          <ThemedText type="code" themeColor="danger">
            {category?.label ?? mistake.category}
          </ThemedText>
        </View>
        {category && (
          <ThemedText type="code" themeColor="textSecondary">
            {ERROR_GROUPS[category.group]}
          </ThemedText>
        )}
      </View>
      <ThemedText type="small">
        <ThemedText type="small" themeColor="danger" style={styles.wrong}>
          {mistake.span}
        </ThemedText>
        {'  →  '}
        <ThemedText type="smallBold" themeColor="success">
          {mistake.correction}
        </ThemedText>
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {mistake.explanation}
      </ThemedText>
    </View>
  );
}

/**
 * A client-side check that the Correct and Simpler tiers stayed inside the
 * official B1 Wortliste. Advisory: the stemmer is crude and legitimate compounds
 * are absent from the list, so this raises candidates rather than asserting an
 * error. It exists because asking a model nicely to write at B1 is not verifiable
 * and this is.
 */
function OutsideWortliste({ feedback, task }: { feedback: Feedback; task: Task }) {
  const theme = useTheme();
  const flagged = aboveB1(`${feedback.tiers.correct} ${feedback.tiers.simpler}`);
  if (flagged.length === 0) return null;

  return (
    <Section title="Außerhalb der B1-Wortliste" tone="warning">
      <ThemedText type="small" themeColor="textSecondary">
        These words in the Correct/Simpler rewrites are not in the official Goethe B1 list. Compounds
        and inflections often fall through this check, so treat it as a prompt to look, not a verdict.
      </ThemedText>
      <View style={styles.chipRow}>
        {flagged.slice(0, 24).map((word) => (
          <View key={word} style={[styles.chip, { backgroundColor: theme.warningSoft }]}>
            <ThemedText type="code" themeColor="warning">
              {word}
            </ThemedText>
          </View>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Aufgabe {task.teil}
      </ThemedText>
    </Section>
  );
}

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'accent';

/** A card whose left edge carries the section's meaning. */
function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: Tone;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.section, { borderColor: theme.border, borderLeftColor: theme[tone] }]}>
      <ThemedText type="smallBold" themeColor={tone as ThemeColor} style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

function Tier({
  label,
  hint,
  text,
  tone,
}: {
  label: string;
  hint: string;
  text: string;
  tone: Tone;
}) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.section, { borderColor: theme.border, borderLeftColor: theme[tone] }]}>
      <ThemedText type="smallBold" themeColor={tone as ThemeColor} style={styles.sectionTitle}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.tierHint}>
        {hint}
      </ThemedText>
      <View style={[styles.tierBody, { backgroundColor: theme[`${tone}Soft` as ThemeColor] }]}>
        <ThemedText type="default">{text}</ThemedText>
      </View>
    </ThemedView>
  );
}

/** Band colour is the score: 3 is earned, 2 is close, 0-1 is where marks leak. */
function Bands({ band }: { band: number }) {
  const theme = useTheme();
  const colour = band >= BAND_MAX ? theme.success : band === 2 ? theme.warning : theme.danger;

  return (
    <View style={styles.bands}>
      {Array.from({ length: BAND_MAX }, (_, i) => (
        <View
          key={i}
          style={[styles.band, { backgroundColor: i < band ? colour : theme.backgroundSelected }]}
        />
      ))}
      <ThemedText type="code" style={{ color: colour }}>
        {'  '}
        {band}/{BAND_MAX}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three, alignSelf: 'stretch' },
  section: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
  },
  sectionTitle: { letterSpacing: 1 },
  tierHint: { marginTop: -Spacing.one },
  tierBody: { padding: Spacing.three, borderRadius: Spacing.two },
  criterion: { gap: Spacing.half },
  criterionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  bands: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },
  band: { width: 20, height: 6, borderRadius: 3 },
  mistake: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.one },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Spacing.two },
  wrong: { textDecorationLine: 'line-through' },
  caveat: { marginTop: Spacing.one },
});
