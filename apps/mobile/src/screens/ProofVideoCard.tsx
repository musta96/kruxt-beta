import React, { useEffect, useState } from "react";
import { Image, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

/**
 * Full-bleed muted, looping video background for a Proof Feed card.
 * Plays only when the card is the active (centered) page so we never have
 * multiple videos playing at once — TikTok-style.
 *
 * `posterUri` (the proof thumbnail) is shown over the player until the video
 * actually starts rendering frames, so cards never flash black before playback.
 */
export function ProofVideoCard({
  uri,
  posterUri,
  isActive,
}: {
  uri: string;
  posterUri?: string | null;
  isActive: boolean;
}) {
  const [showPoster, setShowPoster] = useState(true);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  // Drop the poster once the first frame is actually playing.
  useEffect(() => {
    const sub = player.addListener("playingChange", (payload) => {
      if (payload.isPlaying) {
        setShowPoster(false);
      }
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <>
      <VideoView
        style={styles.video}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      {showPoster && posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={styles.poster}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  video: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});
