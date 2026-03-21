import React from "react";
import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModalProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Main content */
  children: React.ReactNode;
  /** Optional footer (action buttons, etc.) */
  footer?: React.ReactNode;
  /** Bottom safe-area inset */
  bottomInset?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Modal({
  theme,
  visible,
  onClose,
  title,
  children,
  footer,
  bottomInset = 0,
}: ModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close modal"
      />

      {/* Bottom sheet */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.baseSurface,
            borderTopLeftRadius: theme.radii.card * 1.5,
            borderTopRightRadius: theme.radii.card * 1.5,
            paddingBottom: bottomInset,
          },
        ]}
        accessibilityRole="dialog"
        accessibilityLabel={title}
      >
        {/* Handle */}
        <View style={styles.handleRow}>
          <View
            style={[styles.handle, { backgroundColor: `${theme.colors.steel}66` }]}
          />
        </View>

        {/* Header */}
        {title && (
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { color: theme.colors.textPrimary, fontFamily: theme.typography.headline },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
            >
              <Text style={[styles.closeText, { color: theme.colors.textSecondary }]}>
                {"\u2715"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>{children}</View>

        {/* Footer */}
        {footer && (
          <View
            style={[
              styles.footer,
              { borderTopWidth: 1, borderTopColor: `${theme.colors.steel}1A` },
            ]}
          >
            {footer}
          </View>
        )}
      </View>
    </RNModal>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  } as ViewStyle,
  sheet: {
    maxHeight: "85%",
  } as ViewStyle,
  handleRow: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  } as ViewStyle,
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  } as ViewStyle,
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  } as ViewStyle,
  title: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  } as TextStyle,
  closeText: {
    fontSize: 20,
    fontWeight: "400",
    paddingLeft: 12,
  } as TextStyle,
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  } as ViewStyle,
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  } as ViewStyle,
});
