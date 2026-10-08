import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  BANDS,
  type Band,
  type Total,
  bandPoints,
  bandTone,
  formatPoints,
  schreibenMax,
  schreibenTotal,
} from '@/lib/bewertung';
import { ERROR_GROUPS, categoryById } from '@/lib/taxonomy';
import type { Feedback, Task } from '@/lib/types';
import { aboveB1 } from '@/lib/wortliste';

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
              <Bands band={c.band} max={schreibenMax(task.teil, c.criterion)} />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {c.comment}
            </ThemedText>
          </View>
        ))}
        <TotalRow label={`Aufgabe ${task.teil}`} total={schreibenTotal(task.teil, feedback.criteria)} />
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

/** Four segments: A fills all four, each band below empties one, E is empty. */
export function Bands({ band, max }: { band: Band; max: number }) {
  const theme = useTheme();
  const colour = theme[bandTone(band)];
  const filled = BANDS.length - 1 - BANDS.indexOf(band);

  return (
    <View style={styles.bands}>
      {BANDS.slice(1).map((b, i) => (
        <View
          key={b}
          style={[styles.band, { backgroundColor: i < filled ? colour : theme.backgroundSelected }]}
        />
      ))}
      <ThemedText type="code" style={{ color: colour }}>
        {'  '}
        {band} · {formatPoints(bandPoints(band, max))}/{max}
      </ThemedText>
    </View>
  );
}

export function TotalRow({ label, total: { points, max, zeroed } }: { label: string; total: Total }) {
  return (
    <View style={[styles.criterionHead, styles.total]}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="code" themeColor={zeroed ? 'danger' : 'text'}>
        {formatPoints(points)} / {max}
        {zeroed ? '  (Erfüllung E)' : ''}
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
  total: { marginTop: Spacing.one },
});
