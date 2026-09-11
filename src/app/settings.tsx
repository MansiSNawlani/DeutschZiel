import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { GeminiError, listModels, type GeminiModel } from '@/lib/gemini';
import { chooseFolder, folderName, isSupported, reconnectFolder } from '@/lib/journal';
import { loadSettings, saveSettings, type Settings } from '@/lib/settings';
import { WORTLISTE_SIZE } from '@/lib/wortliste';

export default function SettingsScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  /** True while the list is open. Selecting collapses it, which is the confirmation. */
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    void folderName().then(setFolder);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const fetchModels = useCallback(async () => {
    if (!settings?.apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listModels(settings.apiKey);
      setModels(list);
      setPicking(true);
      if (!settings.model && list.length) update({ model: list[0].id });
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [settings?.apiKey, settings?.model, update]);

  const choose = useCallback(
    (model: string) => {
      update({ model });
      setPicking(false);
    },
    [update],
  );

  const pickAnother = useCallback(() => {
    setPicking(true);
    if (models.length === 0) void fetchModels();
  }, [models.length, fetchModels]);

  const connectFolder = useCallback(async () => {
    try {
      setFolder(await chooseFolder());
    } catch {
      // The picker was dismissed. Nothing to report.
    }
  }, []);

  if (!settings) return null;

  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.headerRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {settings.apiKey && settings.model
                ? `Bereit · ${settings.model}`
                : 'Schlüssel und Modell fehlen noch'}
            </ThemedText>
            <Link href="/" asChild>
              <Pressable>
                <ThemedText type="linkPrimary">
                  {settings.apiKey && settings.model ? 'Zu den Aufgaben →' : 'Zurück'}
                </ThemedText>
              </Pressable>
            </Link>
          </View>

          <Card title="Gemini API-Schlüssel">
            <ThemedText type="small" themeColor="textSecondary">
              Your own key, kept in this browser only. Create one free at aistudio.google.com. Your
              actual free-tier rate limits are shown at aistudio.google.com/rate-limit — Google no
              longer publishes them.
            </ThemedText>
            <TextInput
              value={settings.apiKey}
              onChangeText={(apiKey) => update({ apiKey })}
              placeholder="AIza…"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <ThemedText type="small" themeColor="textSecondary">
              On the free tier Google uses submitted content to improve its models. Fine for your own
              practice; worth saying out loud before anyone else uses this.
            </ThemedText>
          </Card>

          <Card title="Modell">
            {settings.model && !picking ? (
              <View
                style={[
                  styles.chosen,
                  { backgroundColor: theme.successSoft, borderColor: theme.success },
                ]}>
                <View style={styles.chosenText}>
                  <ThemedText type="smallBold" themeColor="success">
                    ✓ {settings.model}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Wird für alle Korrekturen verwendet.
                  </ThemedText>
                </View>
                <Pressable onPress={pickAnother}>
                  <ThemedText type="linkPrimary">Ändern</ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.row}>
                  <Pressable
                    onPress={fetchModels}
                    disabled={!settings.apiKey || loading}
                    style={[
                      styles.button,
                      { backgroundColor: theme.primary, opacity: settings.apiKey ? 1 : 0.4 },
                    ]}>
                    <ThemedText type="smallBold" style={styles.onPrimary}>
                      {models.length ? 'Modelle neu laden' : 'Modelle laden'}
                    </ThemedText>
                  </Pressable>
                  {loading && <ActivityIndicator />}
                </View>

                {models.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Model IDs are read from your key rather than hardcoded, because Google&apos;s
                    free-tier lineup changes often. Flash models are listed first — they are the
                    free-tier ones.
                  </ThemedText>
                ) : (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      Tippe ein Modell an, um es zu übernehmen.
                    </ThemedText>
                    {models.slice(0, 12).map((m) => {
                      const selected = m.id === settings.model;
                      return (
                        <Pressable key={m.id} onPress={() => choose(m.id)}>
                          <ThemedView
                            style={[
                              styles.modelRow,
                              {
                                backgroundColor: selected ? theme.primarySoft : 'transparent',
                                borderColor: selected ? theme.primary : theme.border,
                              },
                            ]}>
                            <ThemedText type={selected ? 'smallBold' : 'small'}>
                              {selected ? '✓ ' : ''}
                              {m.id}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {m.displayName}
                            </ThemedText>
                          </ThemedView>
                        </Pressable>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {error && (
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            )}
          </Card>

          <Card title="Journal-Ordner">
            <ThemedText type="small" themeColor="textSecondary">
              Every attempt is written as a Markdown file, and mistakes.md aggregates your recurring
              error categories. Point this at the journal/ folder in the repo — it is gitignored, so
              nothing personal reaches the public remote.
            </ThemedText>
            {isSupported() ? (
              <View style={styles.row}>
                <Pressable
                  onPress={connectFolder}
                  style={[styles.button, { backgroundColor: theme.primary }]}>
                  <ThemedText type="smallBold" style={styles.onPrimary}>
                    {folder ? 'Anderen Ordner wählen' : 'Ordner wählen'}
                  </ThemedText>
                </Pressable>
                {folder && (
                  <Pressable
                    onPress={() => void reconnectFolder()}
                    style={styles.buttonQuiet}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Zugriff erneuern
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            ) : (
              <ThemedText type="small">
                This browser has no File System Access API, so attempts will download as files
                instead. Chrome or Edge can write them straight into the folder.
              </ThemedText>
            )}
            {folder && (
              <ThemedText type="code" themeColor="textSecondary">
                → {folder}
              </ThemedText>
            )}
          </Card>

          <Card title="B1-Wortliste als Obergrenze">
            <View style={styles.switchRow}>
              <ThemedText type="small" style={styles.switchLabel}>
                Send the official Goethe B1 word list ({WORTLISTE_SIZE} headwords) with every
                correction, capping the Correct and Simpler rewrites.
              </ThemedText>
              <Switch
                value={settings.useWortliste}
                onValueChange={(useWortliste) => update({ useWortliste })}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              This is the single biggest part of each prompt. Turn it off if you start hitting
              per-minute token limits — the client-side check on the results still runs either way.
            </ThemedText>
          </Card>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <ThemedText type="smallBold" themeColor="primary" style={styles.cardTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
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
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  cardEdge: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  cardTitle: { letterSpacing: 1 },
  onPrimary: { color: '#FFFFFF' },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
  },
  chosenText: { flex: 1, gap: Spacing.half },
  input: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  buttonQuiet: { paddingVertical: Spacing.two },
  modelRow: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    gap: Spacing.half,
    borderWidth: StyleSheet.hairlineWidth,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchLabel: { flex: 1 },
});
