import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";

import { palette, radius, spacing } from "./theme";

export function ScreenScroll({ children }: PropsWithChildren) {
  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      style={styles.screenShell}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Heading({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.headingBlock}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = "sentences",
  multiline = false
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        style={[styles.input, multiline ? styles.inputMultiline : null]}
      />
    </View>
  );
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchLabel}>{label}</Text>
        {description ? <Text style={styles.switchDescription}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#20314c", true: "rgba(65, 211, 255, 0.32)" }}
        thumbColor={value ? palette.primary : "#5c6c83"}
      />
    </View>
  );
}

export function Button({
  children,
  onPress,
  tone = "primary",
  disabled = false,
  loading = false
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const backgroundColor =
    tone === "primary"
      ? palette.primary
      : tone === "danger"
        ? "rgba(255, 106, 122, 0.16)"
        : "rgba(65, 211, 255, 0.08)";
  const textColor = tone === "primary" ? "#03101f" : tone === "danger" ? palette.danger : palette.text;

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          opacity: disabled || loading ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }]
        }
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonLabel, { color: textColor }]}>{children}</Text>
      )}
    </Pressable>
  );
}

export function InlineButton({
  children,
  onPress
}: {
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.inlineButton}>
      <Text style={styles.inlineButtonLabel}>{children}</Text>
    </Pressable>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "primary" | "danger" | "success" }) {
  const backgroundColor =
    tone === "primary"
      ? "rgba(65, 211, 255, 0.14)"
      : tone === "danger"
        ? "rgba(255, 106, 122, 0.14)"
        : tone === "success"
          ? "rgba(49, 211, 156, 0.14)"
          : "rgba(255, 255, 255, 0.06)";
  const color =
    tone === "primary"
      ? palette.primary
      : tone === "danger"
        ? palette.danger
        : tone === "success"
          ? palette.success
          : palette.textMuted;

  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[styles.pillLabel, { color }]}>{children}</Text>
    </View>
  );
}

export function Banner({
  message,
  tone = "default"
}: {
  message: string;
  tone?: "default" | "danger" | "success";
}) {
  const backgroundColor =
    tone === "danger"
      ? "rgba(255, 106, 122, 0.12)"
      : tone === "success"
        ? "rgba(49, 211, 156, 0.12)"
        : "rgba(255, 255, 255, 0.05)";
  const borderColor = tone === "danger" ? "rgba(255, 106, 122, 0.4)" : tone === "success" ? "rgba(49, 211, 156, 0.32)" : palette.border;
  const textColor = tone === "danger" ? palette.danger : tone === "success" ? palette.success : palette.text;

  return (
    <View style={[styles.banner, { backgroundColor, borderColor }]}>
      <Text style={[styles.bannerText, { color: textColor }]}>{message}</Text>
    </View>
  );
}

export function StatGrid({
  items
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <View style={styles.statGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.statCard}>
          <Text style={styles.statLabel}>{item.label}</Text>
          <Text style={styles.statValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    backgroundColor: palette.background
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  headingBlock: {
    gap: spacing.xs
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    color: palette.text,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "700"
  },
  fieldBlock: {
    gap: spacing.xs
  },
  fieldLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  input: {
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: palette.text,
    fontSize: 15
  },
  inputMultiline: {
    minHeight: 112,
    textAlignVertical: "top"
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  switchCopy: {
    flex: 1,
    gap: 4
  },
  switchLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "600"
  },
  switchDescription: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  button: {
    minHeight: 52,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "800"
  },
  inlineButton: {
    alignSelf: "flex-start",
    paddingVertical: 6
  },
  inlineButtonLabel: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: "700"
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: "700"
  },
  banner: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  statCard: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: palette.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: palette.border
  },
  statLabel: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  statValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: "800"
  }
});
