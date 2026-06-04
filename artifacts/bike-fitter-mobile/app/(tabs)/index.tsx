import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BodyMeasurements, useAppContext } from "@/context/AppContext";
import { calculateLeMond } from "@/lib/lemond";
import { useColors } from "@/hooks/useColors";

function MeasurementInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.secondary,
            color: colors.foreground,
            borderColor: colors.border,
            borderRadius: colors.radiusMd,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        returnKeyType="done"
        testID={`input-${label}`}
      />
    </View>
  );
}

export default function HomeScreen() {
  const { measurements, setMeasurements } = useAppContext();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [height, setHeight] = useState(measurements?.height?.toString() ?? "");
  const [inseam, setInseam] = useState(measurements?.inseam?.toString() ?? "");
  const [armLength, setArmLength] = useState(measurements?.armLength?.toString() ?? "");
  const [torsoLength, setTorsoLength] = useState(measurements?.torsoLength?.toString() ?? "");
  const [bikeType, setBikeType] = useState<BodyMeasurements["bikeType"]>(
    measurements?.bikeType ?? "road"
  );

  const isValid =
    height.length > 0 &&
    inseam.length > 0 &&
    armLength.length > 0 &&
    torsoLength.length > 0;

  const parsedMeasurements: BodyMeasurements | null = isValid
    ? {
        height: parseFloat(height),
        inseam: parseFloat(inseam),
        armLength: parseFloat(armLength),
        torsoLength: parseFloat(torsoLength),
        bikeType,
      }
    : null;

  const lemondResult = parsedMeasurements
    ? calculateLeMond(parsedMeasurements)
    : null;

  const handleStartAnalysis = () => {
    if (!parsedMeasurements) return;
    setMeasurements(parsedMeasurements);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/analyze");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.primary }]}>Bike Fitter</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          專業單車 Fitting 分析
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 120 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radiusXl }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>車種</Text>
          <View style={styles.bikeTypeRow}>
            {(["road", "triathlon"] as const).map((type) => {
              const active = bikeType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setBikeType(type)}
                  style={[
                    styles.bikeTypeBtn,
                    {
                      backgroundColor: active ? colors.primary : colors.secondary,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: colors.radiusMd,
                    },
                  ]}
                  testID={`bike-type-${type}`}
                >
                  <Text
                    style={[
                      styles.bikeTypeTxt,
                      { color: active ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {type === "road" ? "公路車" : "三鐵車"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radiusXl }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>身體數據</Text>
          <View style={styles.inputGrid}>
            <MeasurementInput label="身高 (cm)" value={height} onChangeText={setHeight} placeholder="175" />
            <MeasurementInput label="跨高 (cm)" value={inseam} onChangeText={setInseam} placeholder="82" />
            <MeasurementInput label="臂長 (cm)" value={armLength} onChangeText={setArmLength} placeholder="60" />
            <MeasurementInput label="軀幹長 (cm)" value={torsoLength} onChangeText={setTorsoLength} placeholder="65" />
          </View>
        </View>

        {lemondResult && (
          <View
            style={[
              styles.card,
              styles.resultCard,
              { backgroundColor: colors.card, borderColor: colors.primary + "40", borderRadius: colors.radiusXl },
            ]}
          >
            <View style={styles.resultHeader}>
              <Feather name="activity" size={16} color={colors.primary} />
              <Text style={[styles.resultLabel, { color: colors.primary }]}>
                LeMond 座高預覽
              </Text>
            </View>
            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text style={[styles.resultSubLabel, { color: colors.mutedForeground }]}>
                  建議座高
                </Text>
                <View style={styles.resultValueRow}>
                  <Text style={[styles.resultValue, { color: colors.foreground }]}>
                    {lemondResult.saddleHeight}
                  </Text>
                  <Text style={[styles.resultUnit, { color: colors.mutedForeground }]}>cm</Text>
                </View>
              </View>
              <View style={styles.resultItem}>
                <Text style={[styles.resultSubLabel, { color: colors.mutedForeground }]}>
                  座高範圍
                </Text>
                <Text style={[styles.resultRange, { color: colors.foreground }]}>
                  {lemondResult.saddleHeightMin} - {lemondResult.saddleHeightMax}
                </Text>
              </View>
            </View>
            {lemondResult.saddleSetback && (
              <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
                {lemondResult.saddleSetback}
              </Text>
            )}
            {lemondResult.handlebarDrop && (
              <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
                {lemondResult.handlebarDrop}
              </Text>
            )}
            {lemondResult.saddleForward && (
              <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
                {lemondResult.saddleForward}
              </Text>
            )}
            {lemondResult.aerobarsHeight && (
              <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
                {lemondResult.aerobarsHeight}
              </Text>
            )}
          </View>
        )}

        <Pressable
          onPress={handleStartAnalysis}
          disabled={!isValid}
          style={({ pressed }) => [
            styles.analyzeBtn,
            {
              backgroundColor: isValid ? colors.primary : colors.secondary,
              opacity: pressed ? 0.8 : 1,
              borderRadius: colors.radiusMd,
            },
          ]}
          testID="button-start-analyze"
        >
          <Feather
            name="camera"
            size={20}
            color={isValid ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text
            style={[
              styles.analyzeBtnTxt,
              { color: isValid ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            開始姿態分析
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  headerSub: { fontSize: 16, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600" },
  bikeTypeRow: { flexDirection: "row", gap: 10 },
  bikeTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1.5,
    alignItems: "center",
  },
  bikeTypeTxt: { fontSize: 16, fontWeight: "600" },
  inputGrid: { gap: 12 },
  inputGroup: { gap: 6 },
  label: { fontSize: 16, fontWeight: "500" },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  resultCard: { borderWidth: 1.5 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultLabel: { fontSize: 16, fontWeight: "600" },
  resultRow: { flexDirection: "row", gap: 16 },
  resultItem: { flex: 1 },
  resultSubLabel: { fontSize: 16, marginBottom: 4 },
  resultValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  resultValue: { fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  resultUnit: { fontSize: 16 },
  resultRange: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  resultNote: { fontSize: 16, lineHeight: 22 },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    marginTop: 4,
  },
  analyzeBtnTxt: { fontSize: 17, fontWeight: "700" },
});
