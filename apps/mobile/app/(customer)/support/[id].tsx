/**
 * Support chat thread — realtime messages via @elite/core's
 * `streamTicketMessages`, composer to send. Demo mode shows sample messages
 * and echoes locally.
 */
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { sendTicketMessage, streamTicketMessages } from '@elite/core';
import type { TicketMessage } from '@elite/types';
import { Screen, AppText, Field, Loader } from '../../../components';
import { useTicket } from '../../../lib/hooks';
import { useAuth } from '../../../lib/auth';
import { useLocale } from '../../../lib/i18n';
import { getSupabase } from '../../../lib/supabase';
import { hasLiveBackend } from '../../../lib/env';
import { palette, radii, space } from '../../../lib/palette';

export default function TicketThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const { profile } = useAuth();
  const { data, isLoading } = useTicket(String(id));

  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<TicketMessage>>(null);

  useEffect(() => {
    if (data?.messages) setMessages(data.messages);
  }, [data?.messages]);

  // Realtime new messages (live backend only).
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    const ch = streamTicketMessages(client, String(id), (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    return () => {
      void client.removeChannel(ch);
    };
  }, [id]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    if (hasLiveBackend) {
      const client = getSupabase();
      if (!client || !profile?.id) return;
      await sendTicketMessage(client, String(id), profile.id, body);
      // Realtime echo appends it.
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          ticket_id: String(id),
          sender_id: profile?.id ?? 'sample-user',
          body,
          attachments: [],
          created_at: new Date().toISOString(),
        },
      ]);
    }
  };

  if (isLoading) return <Loader />;

  const myId = profile?.id ?? 'sample-user';

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: data?.subject ?? t('support.title') }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            return (
              <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <AppText style={{ color: mine ? palette.primaryFg : palette.foreground }}>
                    {item.body}
                  </AppText>
                </View>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <View style={styles.composerField}>
            <Field
              placeholder={t('support.typeMessage')}
              value={draft}
              onChangeText={setDraft}
              containerStyle={styles.noMargin}
              onSubmitEditing={send}
              returnKeyType="send"
            />
          </View>
          <Pressable style={styles.sendBtn} onPress={send}>
            <AppText weight="700" style={{ color: palette.primaryFg }}>
              ➤
            </AppText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.background },
  list: { padding: space.md },
  bubbleRow: { marginBottom: space.sm, maxWidth: '85%' },
  rowMine: { alignSelf: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radii.lg },
  bubbleMine: { backgroundColor: palette.primary, borderBottomRightRadius: radii.sm },
  bubbleTheirs: { backgroundColor: palette.surface, borderBottomLeftRadius: radii.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.sm,
    backgroundColor: palette.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  composerField: { flex: 1, marginEnd: space.sm },
  noMargin: { marginBottom: 0 },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
