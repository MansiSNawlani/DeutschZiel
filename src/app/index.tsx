import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { FeedbackView } from '@/components/feedback-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { GeminiError, generateJson } from '@/lib/gemini';
import { loadPatterns, saveAttempt } from '@/lib/journal';
import {
  FEEDBACK_SCHEMA,
  TASK_SCHEMA,
  buildSystemPrompt,
  buildTaskPrompt,
  buildUserPrompt,
} from '@/lib/prompts';
import { loadSettings, type Settings } from '@/lib/settings';
import { SEED_TASKS } from '@/lib/tasks';
import type { Attempt, Feedback, Task } from '@/lib/types';

type Phase = 'choose' | 'writing' | 'grading' | 'feedback';

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

export default function SchreibenScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [phase, setPhase] = useState<Phase>('choose');
  const [task, setTask] = useState<Task | null>(null);
  const [text, setText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<'saved' | 'downloaded' | null>(null);
  const [restored, setRestored] = useState(false);
  const [generating, setGenerating] = useState<1 | 2 | 3 | null>(null);
  const [draftWaiting, setDraftWaiting] = useState(false);
  /** Seconds the current API call has been running. A bare spinner cannot be
   * told apart from a hang, and this app runs on an unmetered free tier where
   * slow responses are normal. */
  const [waiting, setWaiting] = useState(0);
  const startedAt = useRef<number>(0);

  // On focus, not on mount: the Stack keeps this screen mounted while Settings is
  // pushed over it, so a mount-only read would never see a key entered there.
  useFocusEffect(
    useCallback(() => {
      setSettings(loadSettings());
    }, []),
  );

  const resume = useCallback(() => {
    const draft = loadDraft();
    if (!draft) return false;
    setTask(draft.task);
    setText(draft.text);
    setElapsed(draft.elapsed);
    startedAt.current = Date.now() - draft.elapsed * 1000;
    setFeedback(null);
    setSaved(null);
    setRestored(true);
    setPhase('writing');
    return true;
  }, []);

  // Restore an interrupted Aufgabe. Runs once, before anything can overwrite it.
  useEffect(() => {
    resume();
  }, [resume]);

  useEffect(() => {
    const busy = generating !== null || phase === 'grading';
    if (!busy) {
      setWaiting(0);
      return;
    }
    const id = setInterval(() => setWaiting((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [generating, phase]);

  // Advisory only — the clock never locks the submit button. Hard locks make you
  // avoid the tool, and avoidance is the real failure mode over five weeks.
  useEffect(() => {
    if (phase !== 'writing') return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Persist on every keystroke. A reload must never cost a submission.
  useEffect(() => {
    if (phase !== 'writing' || !task) return;
    saveDraft({ task, text, elapsed });
  }, [phase, task, text, elapsed]);

  const begin = useCallback((chosen: Task) => {
    clearDraft();
    setDraftWaiting(false);
    setTask(chosen);
    setText('');
    setFeedback(null);
    setError(null);
    setSaved(null);
    setRestored(false);
    setElapsed(0);
    startedAt.current = Date.now();
    setPhase('writing');
  }, []);

  const generate = useCallback(
    async (teil: 1 | 2 | 3) => {
      if (!settings?.apiKey || !settings.model) return;
      setGenerating(teil);
      setError(null);
      try {
        const draft = await generateJson<{
          title: string;
          instruction: string;
          points: string[];
          targetWords: number;
        }>({
          apiKey: settings.apiKey,
          model: settings.model,
          system: 'You write exam tasks for Goethe-Zertifikat B1 Schreiben. Reply only with JSON.',
          user: buildTaskPrompt(SEED_TASKS, teil),
          schema: TASK_SCHEMA,
          // Higher than for correction: task variety is the whole point here.
          temperature: 1.0,
          maxOutputTokens: 2048,
          timeoutMs: 45_000,
        });

        const shape = SEED_TASKS.find((t) => t.teil === teil);
        begin({
          id: `gen-${teil}-${Date.now()}`,
          teil,
          title: draft.title,
          instruction: draft.instruction,
          points: draft.points,
          register: shape?.register ?? 'informell',
          targetWords: draft.targetWords || (shape?.targetWords ?? 80),
          minutes: shape?.minutes ?? 20,
          source: 'generated',
        });
      } catch (e) {
        setError(e instanceof GeminiError ? e.message : String(e));
      } finally {
        setGenerating(null);
      }
    },
    [settings, begin],
  );

  /** Back to the task list, keeping the draft. Navigating home must never cost work. */
  const backToList = useCallback(() => {
    setDraftWaiting(loadDraft() !== null);
    setRestored(false);
    setPhase('choose');
  }, []);

  /** The only deliberate way to throw a draft away. */
  const discard = useCallback(() => {
    clearDraft();
    setDraftWaiting(false);
    setRestored(false);
    setText('');
    setPhase('choose');
  }, []);

  const submit = useCallback(async () => {
    if (!task || !settings) return;
    setPhase('grading');
    setError(null);

    try {
      const patterns = await loadPatterns();
      const result = await generateJson<Feedback>({
        apiKey: settings.apiKey,
        model: settings.model,
        system: buildSystemPrompt({ useWortliste: settings.useWortliste }),
        user: buildUserPrompt({
          task,
          submission: text,
          wordCount: countWords(text),
          secondsSpent: elapsed,
          recentPatterns: patterns.filter((p) => p.count > 1).slice(0, 8),
        }),
        schema: FEEDBACK_SCHEMA,
      });

      setFeedback(result);
      setPhase('feedback');
      // The submission is graded and about to be journalled; the draft is spent.
      clearDraft();
      setRestored(false);

      const attempt: Attempt = {
        id: `${Date.now()}`,
        task,
        submission: text,
        feedback: result,
        wordCount: countWords(text),
        secondsSpent: elapsed,
        createdAt: new Date().toISOString(),
      };
      setSaved(await saveAttempt(attempt));
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : String(e));
      setPhase('writing');
    }
  }, [task, settings, text, elapsed]);

  if (!settings) return null;

  if (!settings.apiKey || !settings.model) {
    return (
      <Screen>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Erst einrichten</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            DeutschZiel calls Gemini directly from this browser with your own API key. Nothing is sent
            to any server of ours, because there isn&apos;t one.
          </ThemedText>
          <Link href="/settings" asChild>
            {/* Link asChild clones props onto the child, so the style must be flat. */}
            <Pressable
              style={StyleSheet.flatten([styles.button, { backgroundColor: theme.primary }])}>
              <ThemedText type="smallBold" style={styles.onPrimary}>
                Einstellungen öffnen
              </ThemedText>
            </Pressable>
          </Link>
        </ThemedView>
      </Screen>
    );
  }

  if (phase === 'choose') {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <ThemedText type="subtitle">Schreiben</ThemedText>
          <Link href="/settings" asChild>
            <Pressable>
              <ThemedText type="linkPrimary">Einstellungen</ThemedText>
            </Pressable>
          </Link>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Goethe-Zertifikat B1 · three Aufgaben, 60 minutes total in the real exam.
        </ThemedText>

        {error && (
          <ThemedView
            style={[styles.card, styles.alert, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
            <ThemedText type="smallBold" themeColor="danger">
              Fehler
            </ThemedText>
            <ThemedText type="small">{error}</ThemedText>
          </ThemedView>
        )}

        {draftWaiting && (
          <ThemedView
            style={[styles.card, styles.alert, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
            <ThemedText type="smallBold" themeColor="warning">
              Angefangener Entwurf
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              You have an unfinished Aufgabe. It stays here until you submit it or discard it.
            </ThemedText>
            <View style={styles.actions}>
              <Pressable onPress={resume} style={styles.buttonQuiet}>
                <ThemedText type="linkPrimary">Fortsetzen →</ThemedText>
              </Pressable>
              <Pressable onPress={discard} style={styles.buttonQuiet}>
                <ThemedText type="small" themeColor="textSecondary">
                  Verwerfen
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        )}

        {SEED_TASKS.map((t) => (
          <ThemedView
            key={t.id}
            type="backgroundElement"
            style={[styles.card, styles.taskCard, { borderColor: theme.border, borderLeftColor: theme.primary }]}>
            <Pressable onPress={() => begin(t)}>
              <ThemedText type="smallBold">{t.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t.instruction}
              </ThemedText>
              <ThemedText type="code" themeColor="textSecondary">
                ~{t.targetWords} Wörter · {t.minutes} Min · {t.register}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => void generate(t.teil)}
              disabled={generating !== null}
              style={[styles.generateRow, { borderTopColor: theme.border }]}>
              {generating === t.teil ? (
                <>
                  <ActivityIndicator />
                  <ThemedText type="small" themeColor="textSecondary">
                    Neue Aufgabe wird geschrieben… {waiting}s
                  </ThemedText>
                </>
              ) : (
                <ThemedText type="linkPrimary">↻ Neue Aufgabe {t.teil} generieren</ThemedText>
              )}
            </Pressable>
          </ThemedView>
        ))}

        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          These three are placeholders shaped like the real Aufgaben, and the generator copies their
          format. Replace them with tasks from the Goethe Modellsatz once you have it — then keep the
          official ones back for cold timed mocks and practise on generated ones.
        </ThemedText>
      </Screen>
    );
  }

  if (!task) return null;

  const words = countWords(text);
  const remaining = task.minutes * 60 - elapsed;
  const overTime = remaining < 0;
  const overLength = words > task.targetWords * 1.35;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={backToList}>
          <ThemedText type="linkPrimary">← Aufgaben</ThemedText>
        </Pressable>
        <Link href="/settings" asChild>
          <Pressable>
            <ThemedText type="linkPrimary">Einstellungen</ThemedText>
          </Pressable>
        </Link>
      </View>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">{task.title}</ThemedText>
        <ThemedText type="small">{task.instruction}</ThemedText>
        {task.points.map((p, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary">
            {i + 1}. {p}
          </ThemedText>
        ))}
      </ThemedView>

      {restored && (
        <ThemedView
          style={[styles.card, styles.alert, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
          <ThemedText type="small" themeColor="primary">
            Entwurf wiederhergestellt — deine Aufgabe war noch da. Die Uhr läuft dort weiter, wo sie
            aufgehört hat.
          </ThemedText>
        </ThemedView>
      )}

      <View style={styles.meterRow}>
        <ThemedText type="code" themeColor={overLength ? 'warning' : 'textSecondary'}>
          {words} / ~{task.targetWords} Wörter{overLength ? '  ⚠ zu lang' : ''}
        </ThemedText>
        <ThemedText type="code" themeColor={overTime ? 'warning' : 'textSecondary'}>
          {overTime ? '+' : ''}
          {formatClock(Math.abs(remaining))}
          {overTime ? '  ⚠ über der Zeit' : ''}
        </ThemedText>
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        editable={phase === 'writing'}
        multiline
        textAlignVertical="top"
        placeholder="Schreiben Sie hier…"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      />

      {error && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Fehler</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {error}
          </ThemedText>
        </ThemedView>
      )}

      {phase === 'grading' && (
        <View style={styles.grading}>
          <ActivityIndicator />
          <ThemedText type="small" themeColor="textSecondary">
            Wird korrigiert… {waiting}s
          </ThemedText>
        </View>
      )}

      {phase === 'writing' && (
        <View style={styles.actions}>
          <Pressable
            onPress={submit}
            disabled={words === 0}
            style={[
              styles.button,
              { backgroundColor: theme.primary, opacity: words === 0 ? 0.4 : 1 },
            ]}>
            <ThemedText type="smallBold" style={styles.onPrimary}>
              Abgeben
            </ThemedText>
          </Pressable>
          <Pressable onPress={discard} style={styles.buttonQuiet}>
            <ThemedText type="small" themeColor="textSecondary">
              Entwurf verwerfen
            </ThemedText>
          </Pressable>
        </View>
      )}

      {feedback && (
        <>
          {saved && (
            <ThemedText type="small" themeColor="textSecondary">
              {saved === 'saved'
                ? 'Saved to your journal folder.'
                : 'Downloaded — connect a journal folder in Einstellungen to write files directly.'}
            </ThemedText>
          )}
          <FeedbackView feedback={feedback} task={task} />
        </>
      )}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </ThemedView>
  );
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  meterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  input: {
    minHeight: 240,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  buttonQuiet: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  grading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  generateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  taskCard: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
  alert: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
  onPrimary: { color: '#FFFFFF' },
  note: { fontStyle: 'italic' },
});
