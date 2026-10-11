'use client';

import { Button } from '@healwyn/ui';
import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrack } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { Transcript } from './assistant-widget';

type Line = { id: string; from: 'assistant' | 'you'; text: string };

const CONNECT_TIMEOUT_MS = 12_000;
const AGENT_TIMEOUT_MS = 15_000;

/**
 * The live voice call (loaded only when a visitor starts one). It asks for
 * the microphone, joins the LiveKit room the server prepared, plays the
 * assistant's voice and shows live captions from both sides. If the microphone
 * is refused, or the assistant does not join, it hands over to typed chat.
 */
export function VoiceCall({
  serverUrl,
  token,
  lines,
  onLine,
  onEnded,
  onFallback,
}: {
  serverUrl: string;
  token: string;
  lines: Line[];
  onLine: (from: Line['from'], text: string) => void;
  onEnded: () => void;
  onFallback: (reason: string) => void;
}) {
  const [status, setStatus] = useState<'mic' | 'connecting' | 'waiting' | 'live' | 'ended'>('mic');
  const [muted, setMuted] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onLine, onEnded, onFallback });
  useEffect(() => {
    callbacks.current = { onLine, onEnded, onFallback };
  });

  useEffect(() => {
    let cancelled = false;
    let agentTimer: ReturnType<typeof setTimeout> | undefined;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const segments = new Map<string, string>();

    const finish = () => {
      if (cancelled) return;
      setStatus('ended');
      void room.disconnect();
      callbacks.current.onEnded();
    };

    room.registerTextStreamHandler('lk.transcription', async (reader, participant) => {
      const text = (await reader.readAll()).trim();
      const segment = reader.info.attributes?.['lk.segment_id'] ?? reader.info.id;
      if (!text || segments.get(segment) === text) return;
      segments.set(segment, text);
      callbacks.current.onLine(participant.identity === room.localParticipant.identity ? 'you' : 'assistant', text);
    });
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) audioRef.current?.appendChild(track.attach());
    });
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (participant.isAgent) {
        clearTimeout(agentTimer);
        setStatus('live');
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (participant.isAgent) finish();
    });
    room.on(RoomEvent.Disconnected, () => finish());

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        if (!cancelled) callbacks.current.onFallback('No microphone, so let’s continue by typing.');
        return;
      }
      if (cancelled) return;
      setStatus('connecting');
      try {
        // A network that blocks LiveKit would otherwise keep the visitor waiting while every region is tried.
        await Promise.race([
          room.connect(serverUrl, token),
          new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), CONNECT_TIMEOUT_MS)),
        ]);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (cancelled) return;
        const agentHere = [...room.remoteParticipants.values()].some((p) => p.isAgent);
        setStatus(agentHere ? 'live' : 'waiting');
        if (!agentHere) {
          agentTimer = setTimeout(() => {
            if (cancelled) return;
            cancelled = true;
            void room.disconnect();
            callbacks.current.onFallback('The voice line is busy, so let’s continue by typing.');
          }, AGENT_TIMEOUT_MS);
        }
      } catch {
        if (!cancelled) {
          cancelled = true;
          void room.disconnect();
          callbacks.current.onFallback('We could not connect the voice call, so let’s continue by typing.');
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(agentTimer);
      room.unregisterTextStreamHandler('lk.transcription');
      void room.disconnect();
    };
  }, [serverUrl, token]);

  return (
    <div className="grid gap-4">
      <p role="status" className="font-semibold">
        {status === 'mic'
          ? 'Your browser will ask to use your microphone.'
          : status === 'connecting'
            ? 'Connecting…'
            : status === 'waiting'
              ? 'Connected. The assistant is joining…'
              : status === 'live'
                ? muted
                  ? 'You are muted.'
                  : 'The assistant is listening. Speak naturally; you can interrupt.'
                : 'The call has ended.'}
      </p>
      <div ref={audioRef} hidden />
      <Transcript lines={lines} live />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          aria-pressed={muted}
          disabled={status !== 'live'}
          onClick={async () => {
            const next = !muted;
            await roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
            setMuted(next);
          }}
        >
          {muted ? 'Unmute' : 'Mute'}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setStatus('ended');
            void roomRef.current?.disconnect();
          }}
        >
          End call
        </Button>
      </div>
    </div>
  );
}
