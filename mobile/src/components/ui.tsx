import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, MaxContentWidth, Radius, Spacing, useTheme } from '@/constants/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

export function AppText({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const theme = useTheme();
  const isSecondary = variant === 'caption';
  const serif = variant === 'display' || variant === 'title';
  return (
    <Text
      style={[
        {
          color: color ?? (isSecondary ? theme.textSecondary : theme.text),
          fontFamily: serif ? Fonts.serif : Fonts.sans,
        },
        textStyles[variant],
        style,
      ]}
      {...rest}
    />
  );
}

const textStyles = StyleSheet.create({
  display: { fontSize: 44, lineHeight: 50, fontWeight: '400', letterSpacing: -0.8 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '400', letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
});

/** Scrollable, centered page with a max width so it reads well on desktop browsers too. */
export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  ...rest
}: ScrollViewProps & {
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          ) : undefined
        }
        {...rest}>
        <View style={[styles.page, contentStyle]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  ...rest
}: PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.primary, fg: theme.primaryText, border: theme.primary },
    secondary: { bg: theme.card, fg: theme.text, border: theme.border },
    danger: { bg: theme.dangerSoft, fg: theme.danger, border: theme.dangerSoft },
    ghost: { bg: 'transparent', fg: theme.primary, border: 'transparent' },
  }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && { opacity: 0.8 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={palette.fg} />}
          <AppText variant="label" color={palette.fg}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export const TextField = forwardRef<TextInput, TextInputProps & { label: string; error?: string }>(
  function TextField({ label, error, style, ...rest }, ref) {
    const theme = useTheme();
    return (
      <View style={{ gap: Spacing.xs }}>
        <AppText variant="label">{label}</AppText>
        <TextInput
          ref={ref}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.card,
              borderColor: error ? theme.danger : theme.border,
              fontFamily: Fonts.sans,
            },
            style,
          ]}
          {...rest}
        />
        {error ? (
          <AppText variant="caption" color={theme.danger}>
            {error}
          </AppText>
        ) : null}
      </View>
    );
  },
);

export function Banner({ message, tone = 'danger' }: { message: string; tone?: 'danger' | 'success' }) {
  const theme = useTheme();
  const bg = tone === 'danger' ? theme.dangerSoft : theme.successSoft;
  const fg = tone === 'danger' ? theme.danger : theme.success;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={tone === 'danger' ? 'alert-circle' : 'checkmark-circle'} size={18} color={fg} />
      <AppText variant="label" color={fg} style={{ flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning';
}) {
  const theme = useTheme();
  const colors = {
    neutral: { bg: theme.muted, fg: theme.textSecondary },
    primary: { bg: theme.primarySoft, fg: theme.primary },
    success: { bg: theme.successSoft, fg: theme.success },
    warning: { bg: theme.warningSoft, fg: theme.warning },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <AppText variant="caption" color={colors.fg} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

/** Selectable pill, used for weekdays, tariffs and extras. */
export function Chip({
  label,
  selected,
  disabled,
  onPress,
  style,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.card,
          borderColor: selected ? theme.primary : theme.border,
        },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.8 },
        style,
      ]}>
      <AppText variant="label" color={selected ? theme.primaryText : theme.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Horizontal row of day chips (Today, Sat 7 …). */
export function DateStrip({
  dates,
  value,
  onChange,
  compact,
}: {
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
      {dates.map((d, i) => {
        const day = new Date(`${d}T00:00:00Z`);
        const weekday = i === 0 ? 'Today' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getUTCDay()];
        const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][day.getUTCMonth()];
        const active = d === value;
        const fg = active ? theme.primaryText : theme.text;
        const sub = active ? theme.primaryText : theme.textSecondary;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              compact ? styles.dateChipCompact : styles.dateChip,
              { backgroundColor: active ? theme.primary : theme.card, borderColor: active ? theme.primary : theme.border },
            ]}>
            <AppText variant="caption" color={sub}>
              {weekday}
            </AppText>
            {compact ? (
              <AppText variant="label" color={fg}>
                {month} {day.getUTCDate()}
              </AppText>
            ) : (
              <>
                <AppText variant="heading" color={fg}>
                  {day.getUTCDate()}
                </AppText>
                <AppText variant="caption" color={sub}>
                  {month}
                </AppText>
              </>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="heading">{children}</AppText>
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name={icon} size={28} color={theme.primary} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="caption" style={{ textAlign: 'center', maxWidth: 320 }}>
          {message}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  page: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  input: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  dateChip: { width: 64, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center' },
  dateChipCompact: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  chip: {
    minHeight: 40,
    minWidth: 52,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
});
