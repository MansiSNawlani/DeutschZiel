import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { blobToBase64, isRecordingSupported, startRecording, type Recorder, type Recording } from '@/lib/audio';
import { GeminiError, generateJson } from '@/lib/gemini';
import { saveSpeakingAttempt } from '@/lib/journal';
import {
  clearRecordingDraft,
  loadRecordingDraft,
  saveRecordingDraft,
} from '@/lib/recording-draft';
import {
  FOLIEN,
  SEED_TOPICS,
  SPEAKING_SCHEMA,
  TOPIC_SCHEMA,
  buildSpeakingSystemPrompt,
  buildSpeakingUserPrompt,
  buildTopicPrompt,
  type SpeakingFeedback,
  type SpeakingTask,
} from '@/lib/speaking';
import { loadSettings, type Settings } from '@/lib/settings';
import { categoryById } from '@/lib/taxonomy';

type Phase = 'choose' | 'ready' | 'recording' | 'review' | 'grading' | 'feedback';

const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function SprechenScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [phase, setPhase] = useState<Phase>('choose');
  const [task, setTask] = useState<SpeakingTask | null>(null);
  const [topics, setTopics] = useState<SpeakingTask[]>(SEED_TOPICS);
  const [seconds, setSeconds] = useState(0);
  const [waiting, setWaiting] = useState(0);
  /** Which request to the model is in flight. Shown only from the second, so a
   * resend after a busy model reads as progress rather than as the same wait
   * going nowhere. Deliberately not called an attempt: CONTEXT.md reserves that
   * word for one Task, one Submission and its Feedback. */
  const [request, setRequest] = useState<{ current: number; total: number } | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [saved, setSaved] = useState<'saved' | 'downloaded' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const recorder = useRef<Recorder | null>(null);
  /** The restore read resolves asynchronously and must test the phase as it is
   * by then, not the one captured when the effect first ran. */
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useFocusEffect(
    useCallback(() => {
      setSettings(loadSettings());
    }, []),
  );

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'grading') {
      setWaiting(0);
      return;
    }
    const id = setInterval(() => setWaiting((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // An object URL per recording; without this every retake leaks one.
  useEffect(() => () => {
    if (recording) URL.revokeObjectURL(recording.url);
  }, [recording]);

  // The take outlives this screen. Opening Einstellungen unmounts the component
  // and a reload obviously does, and re-recording a three-minute presentation is
  // a real cost, not an inconvenience. Restoring is what makes every later
  // failure cost a button press instead.
  const restoreAttempted = useRef(false);
  useEffect(() => {
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;
    let cancelled = false;
    void loadRecordingDraft().then((draft) => {
      // The read can finish after the learner has already picked a topic and
      // started talking. Restoring then would swap the task under them, show
      // the old recording as if it were the new one, and orphan the live
      // recorder so the microphone never gets released.
      if (cancelled || !draft) return;
      if (phaseRef.current !== 'choose' || recorder.current) return;
      setTask(draft.task);
      setRecording({
        wav: draft.wav,
        url: URL.createObjectURL(draft.wav),
        seconds: draft.seconds,
      });
      setSeconds(draft.seconds);
      setPhase('review');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const begin = useCallback((chosen: SpeakingTask) => {
    void clearRecordingDraft();
    setTask(chosen);
    setRecording(null);
    setFeedback(null);
    setSaved(null);
    setError(null);
    setSeconds(0);
    setPhase('ready');
  }, []);

  /** "Noch einmal": the learner is throwing this recording away, so it must not
   * survive on disk to be restored later as though it were still wanted. */
  const discard = useCallback(() => {
    void clearRecordingDraft();
    setRecording(null);
    setSeconds(0);
    setPhase('ready');
  }, []);

  const record = useCallback(async () => {
    setError(null);
    try {
      recorder.current = await startRecording();
      setSeconds(0);
      setPhase('recording');
    } catch (e) {
      setError(
        `Could not start recording: ${String(e)}. The browser needs microphone permission, and getUserMedia only works on localhost or https.`,
      );
    }
  }, []);

  const stop = useCallback(async () => {
    if (!recorder.current) return;
    try {
      const result = await recorder.current.stop();
      setRecording(result);
      setPhase('review');
      if (task) void saveRecordingDraft(result, task);
    } catch (e) {
      setError(`Could not finish the recording: ${String(e)}`);
      setPhase('ready');
    } finally {
      recorder.current = null;
    }
  }, [task]);

  const submit = useCallback(async () => {
    if (!task || !recording || !settings) return;
    setPhase('grading');
    setError(null);
    setRequest(null);
    try {
      const result = await generateJson<SpeakingFeedback>({
        apiKey: settings.apiKey,
        model: settings.model,
        system: buildSpeakingSystemPrompt(),
        user: buildSpeakingUserPrompt(task, recording.seconds),
        audio: { mimeType: 'audio/wav', base64: await blobToBase64(recording.wav) },
        schema: SPEAKING_SCHEMA,
        // Audio takes longer to process than text, and a three-minute take is large.
        timeoutMs: 180_000,
        onRequest: (current, total) => setRequest({ current, total }),
      });
      setFeedback(result);
      setPhase('feedback');
      // Cleared as soon as grading succeeds, deliberately before the journal
      // write rather than after it. That write can fail on its own, typically a
      // revoked folder permission, and a graded recording left behind would be
      // restored as a finished Attempt and invite paying to grade it twice.
      void clearRecordingDraft();
      setSaved(
        await saveSpeakingAttempt({
          task,
          feedback: result,
          seconds: recording.seconds,
          createdAt: new Date().toISOString(),
        }),
      );
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : String(e));
      setPhase('review');
    }
  }, [task, recording, settings]);

  const newTopic = useCallback(async () => {
    if (!settings?.apiKey || !settings.model) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateJson<{ topic: string }>({
        apiKey: settings.apiKey,
        model: settings.model,
        system: 'You write exam topics for Goethe-Zertifikat B1 Sprechen. Reply only with JSON.',
        user: buildTopicPrompt(topics),
        schema: TOPIC_SCHEMA,
        temperature: 1.0,
        maxOutputTokens: 512,
        timeoutMs: 45_000,
      });
      const fresh: SpeakingTask = {
        id: `sp-gen-${Date.now()}`,
        topic: result.topic,
        targetSeconds: 180,
        source: 'generated',
      };
      setTopics((prev) => [fresh, ...prev]);
      begin(fresh);
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [settings, topics, begin]);

  if (!settings) return null;

  if (!settings.apiKey || !settings.model) {
    return (
      <Screen>
        <Header />
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Erst einrichten</ThemedText>
          <Link href="/settings" asChild>
            <Pressable>
              <ThemedText type="linkPrimary">Einstellungen öffnen →</ThemedText>
            </Pressable>
          </Link>
        </ThemedView>
      </Screen>
    );
  }

  if (!isRecordingSupported()) {
    return (
      <Screen>
        <Header />
        <Alert tone="danger" title="Aufnahme nicht möglich">
          This browser cannot record audio. Sprechen needs MediaRecorder and microphone access, which
          means Chrome or Edge, served over localhost or https.
        </Alert>
      </Screen>
    );
  }

  if (phase === 'choose') {
    return (
      <Screen>
        <Header />
        <ThemedText type="small" themeColor="textSecondary">
          Teil 2 · Ein Thema präsentieren. Etwa drei Minuten, allein, fünf feste Folien.
        </ThemedText>
        {error && <Alert tone="danger" title="Fehler">{error}</Alert>}

        <Pressable onPress={() => void newTopic()} disabled={generating}>
          <ThemedView
            style={[styles.card, styles.edged, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            {generating ? (
              <View style={styles.row}>
                <ActivityIndicator />
                <ThemedText type="small" themeColor="textSecondary">
                  Neues Thema wird geschrieben…
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="smallBold" themeColor="accent">
                ↻ Neues Thema generieren
              </ThemedText>
            )}
          </ThemedView>
        </Pressable>

        {topics.map((t) => (
          <Pressable key={t.id} onPress={() => begin(t)}>
            <ThemedView
              type="backgroundElement"
              style={[styles.card, styles.edged, { borderColor: theme.border, borderLeftColor: theme.primary }]}>
              <ThemedText type="smallBold">{t.topic}</ThemedText>
              <ThemedText type="code" themeColor="textSecondary">
                ~{t.targetSeconds / 60} Min · {t.source === 'generated' ? 'generiert' : 'Standard'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </Screen>
    );
  }

  if (!task) return null;

  return (
    <Screen>
      <Header onBack={() => setPhase('choose')} />

      <ThemedView
        type="backgroundElement"
        style={[styles.card, styles.edged, { borderColor: theme.border, borderLeftColor: theme.primary }]}>
        <ThemedText type="subtitle">{task.topic}</ThemedText>
        {FOLIEN.map((f, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary">
            {i + 1}. {f}
          </ThemedText>
        ))}
      </ThemedView>

      {error && <Alert tone="danger" title="Fehler">{error}</Alert>}

      {phase === 'ready' && (
        <Pressable onPress={() => void record()} style={[styles.bigButton, { backgroundColor: theme.danger }]}>
          <ThemedText type="smallBold" style={styles.onFilled}>
            ● Aufnahme starten
          </ThemedText>
        </Pressable>
      )}

      {phase === 'recording' && (
        <>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: theme.danger }]} />
            <ThemedText type="subtitle" themeColor={seconds > task.targetSeconds ? 'warning' : 'text'}>
              {clock(seconds)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              / {clock(task.targetSeconds)}
            </ThemedText>
          </View>
          <Pressable onPress={() => void stop()} style={[styles.bigButton, { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" style={styles.onFilled}>
              ■ Fertig
            </ThemedText>
          </Pressable>
        </>
      )}

      {phase === 'review' && recording && (
        <>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Aufnahme · {clock(recording.seconds)}</ThemedText>
            <audio controls src={recording.url} style={{ width: '100%' }} />
          </ThemedView>
          <View style={styles.row}>
            <Pressable onPress={() => void submit()} style={[styles.bigButton, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={styles.onFilled}>
                Abgeben
              </ThemedText>
            </Pressable>
            <Pressable onPress={discard} style={styles.quiet}>
              <ThemedText type="small" themeColor="textSecondary">
                Noch einmal
              </ThemedText>
            </Pressable>
          </View>
        </>
      )}

      {phase === 'grading' && (
        <View style={styles.row}>
          <ActivityIndicator />
          <ThemedText type="small" themeColor="textSecondary">
            Wird angehört und bewertet… {waiting}s
            {request && request.current > 1 ? ` · Anfrage ${request.current} von ${request.total}` : ''}
          </ThemedText>
        </View>
      )}

      {feedback && <SpeakingFeedbackView feedback={feedback} saved={saved} />}
    </Screen>
  );
}

function SpeakingFeedbackView({
  feedback,
  saved,
}: {
  feedback: SpeakingFeedback;
  saved: 'saved' | 'downloaded' | null;
}) {
  const theme = useTheme();

  return (
    <View style={styles.stack}>
      {saved && (
        <ThemedText type="small" themeColor="textSecondary">
          {saved === 'saved' ? 'Im Journal gespeichert.' : 'Heruntergeladen.'}
        </ThemedText>
      )}

      {/* First on the page on purpose: it is the evidence for everything below it. */}
      <ThemedView
        type="backgroundElement"
        style={[styles.card, styles.edged, { borderColor: theme.border, borderLeftColor: theme.warning }]}>
        <ThemedText type="smallBold" themeColor="warning" style={styles.sectionTitle}>
          WAS DAS MODELL GEHÖRT HAT
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Read this before anything else. If it looks tidier than what actually came out of your
          mouth, the model repaired your German on the way in — and every grammar judgement below is
          flattering you. If your real mistakes are in here, the feedback can be trusted.
        </ThemedText>
        <View style={[styles.quote, { backgroundColor: theme.warningSoft }]}>
          <ThemedText type="default">{feedback.transcript}</ThemedText>
        </View>
      </ThemedView>

      <ThemedView
        type="backgroundElement"
        style={[styles.card, styles.edged, { borderColor: theme.border, borderLeftColor: theme.primary }]}>
        <ThemedText type="smallBold" themeColor="primary" style={styles.sectionTitle}>
          FOLIEN
        </ThemedText>
        {feedback.folien.map((f) => (
          <View key={f.folie} style={styles.folie}>
            <ThemedText type="smallBold" themeColor={f.covered ? 'success' : 'danger'}>
              {f.covered ? '✓' : '✗'} Folie {f.folie}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {f.comment}
            </ThemedText>
          </View>
        ))}
      </ThemedView>

      <ThemedView
        type="backgroundElement"
        style={[styles.card, styles.edged, { borderColor: theme.border, borderLeftColor: theme.primary }]}>
        <ThemedText type="smallBold" themeColor="primary" style={styles.sectionTitle}>
          BEWERTUNG
        </ThemedText>
        {feedback.criteria.map((c) => {
          const colour = c.band >= 3 ? theme.success : c.band === 2 ? theme.warning : theme.danger;
          return (
            <View key={c.criterion} style={styles.folie}>
              <View style={styles.criterionHead}>
                <ThemedText type="smallBold">{c.criterion}</ThemedText>
                <ThemedText type="code" style={{ color: colour }}>
                  {c.band}/3
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {c.comment}
              </ThemedText>
            </View>
          );
        })}
      </ThemedView>

      <ThemedView
        type="backgroundElement"
        style={[
          styles.card,
          styles.edged,
          { borderColor: theme.border, borderLeftColor: feedback.mistakes.length ? theme.danger : theme.success },
        ]}>
        <ThemedText
          type="smallBold"
          themeColor={feedback.mistakes.length ? 'danger' : 'success'}
          style={styles.sectionTitle}>
          FEHLER ({feedback.mistakes.length})
        </ThemedText>
        {feedback.mistakes.map((m, i) => (
          <View key={i} style={[styles.folie, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two }]}>
            <View style={[styles.chip, { backgroundColor: theme.dangerSoft }]}>
              <ThemedText type="code" themeColor="danger">
                {categoryById(m.category)?.label ?? m.category}
              </ThemedText>
            </View>
            <ThemedText type="small">
              <ThemedText type="small" themeColor="danger" style={styles.struck}>
                {m.said}
              </ThemedText>
              {'  →  '}
              <ThemedText type="smallBold" themeColor="success">
                {m.correction}
              </ThemedText>
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {m.explanation}
            </ThemedText>
          </View>
        ))}
      </ThemedView>

      {feedback.betterPhrasings.length > 0 && (
        <ThemedView
          type="backgroundElement"
          style={[styles.card, styles.edged, { borderColor: theme.border, borderLeftColor: theme.accent }]}>
          <ThemedText type="smallBold" themeColor="accent" style={styles.sectionTitle}>
            NATÜRLICHER SAGEN
          </ThemedText>
          {feedback.betterPhrasings.map((p, i) => (
            <View key={i} style={styles.folie}>
              <ThemedText type="small" themeColor="textSecondary">
                {p.said}
              </ThemedText>
              <ThemedText type="smallBold" themeColor="accent">
                → {p.better}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {p.why}
              </ThemedText>
            </View>
          ))}
        </ThemedView>
      )}

      <ThemedView
        type="backgroundElement"
        style={[styles.card, styles.edged, { borderColor: theme.border, borderLeftColor: theme.primary }]}>
        <ThemedText type="smallBold" themeColor="primary" style={styles.sectionTitle}>
          NÄCHSTES MAL
        </ThemedText>
        <ThemedText type="small">{feedback.summary}</ThemedText>
      </ThemedView>
    </View>
  );
}

function Header({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.headerRow}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <ThemedText type="linkPrimary">← Themen</ThemedText>
        </Pressable>
      ) : (
        <Link href="/" asChild>
          <Pressable>
            <ThemedText type="linkPrimary">← Schreiben</ThemedText>
          </Pressable>
        </Link>
      )}
      <Link href="/settings" asChild>
        <Pressable>
          <ThemedText type="linkPrimary">Einstellungen</ThemedText>
        </Pressable>
      </Link>
    </View>
  );
}

function Alert({
  tone,
  title,
  children,
}: {
  tone: 'danger' | 'warning';
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <ThemedView
      style={[
        styles.card,
        styles.edged,
        { backgroundColor: theme[`${tone}Soft`], borderColor: theme[tone] },
      ]}>
      <ThemedText type="smallBold" themeColor={tone}>
        {title}
      </ThemedText>
      <ThemedText type="small">{children}</ThemedText>
    </ThemedView>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing.three, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  stack: { gap: Spacing.three, alignSelf: 'stretch' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  edged: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
  sectionTitle: { letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  bigButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  quiet: { paddingVertical: Spacing.two },
  onFilled: { color: '#FFFFFF' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  quote: { padding: Spacing.three, borderRadius: Spacing.two },
  folie: { gap: Spacing.half },
  criterionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { alignSelf: 'flex-start', paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Spacing.two },
  struck: { textDecorationLine: 'line-through' },
});
