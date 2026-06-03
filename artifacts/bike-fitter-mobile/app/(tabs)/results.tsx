import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AngleAnalysis, FittingRecord, KOPSAnalysis, useAppContext } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { analyzeAngles, analyzeKOPS, calculateFitScore } from "@/lib/analyze";
import { calculateLeMond } from "@/lib/lemond";

function statusColor(status: "符合" | "偏高" | "偏低", colors: ReturnType<typeof useColors>) {
  if (status === "符合") return colors.success;
  if (status === "偏高") return colors.warning;
  return "#ef4444";
}

function AngleCard({ analysis }: { analysis: AngleAnalysis }) {
  const colors = useColors();
  const sc = statusColor(analysis.status, colors);
  const isGood = analysis.status === "符合";

  return (
    <View style={[styles.angleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.angleHeader}>
        <View style={styles.angleLeft}>
          <Text style={[styles.angleName, { color: colors.foreground }]}>{analysis.name}</Text>
          <Text style={[styles.angleDesc, { color: colors.mutedForeground }]}>
            {analysis.description}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc + "20", borderColor: sc + "40" }]}>
          <Text style={[styles.statusTxt, { color: sc }]}>{analysis.status}</Text>
        </View>
      </View>
      <View style={styles.angleValues}>
        <View style={styles.angleValueItem}>
          <Text style={[styles.angleLabel, { color: colors.mutedForeground }]}>偵測值</Text>
          <Text style={[styles.angleNum, { color: isGood ? colors.success : sc }]}>
            {analysis.detected.toFixed(1)}
            {analysis.unit}
          </Text>
        </View>
        <View style={styles.angleValueItem}>
          <Text style={[styles.angleLabel, { color: colors.mutedForeground }]}>建議範圍</Text>
          <Text style={[styles.angleNum, { color: colors.foreground }]}>
            {analysis.recommendedMin}-{analysis.recommendedMax}
            {analysis.unit}
          </Text>
        </View>
      </View>
      {!isGood && (
        <View style={[styles.suggestionBox, { backgroundColor: sc + "10", borderColor: sc + "30" }]}>
          <Feather name="info" size={13} color={sc} />
          <Text style={[styles.suggestionTxt, { color: sc }]}>{analysis.suggestion}</Text>
        </View>
      )}
    </View>
  );
}

function KOPSCard({ kops }: { kops: KOPSAnalysis }) {
  const colors = useColors();
  const sc = kops.isOptimal ? colors.success : colors.warning;

  return (
    <View style={[styles.angleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.angleHeader}>
        <View style={styles.angleLeft}>
          <Text style={[styles.angleName, { color: colors.foreground }]}>KOPS 膝蓋對齊</Text>
          <Text style={[styles.angleDesc, { color: colors.mutedForeground }]}>
            3 點鐘位置膝蓋垂直對齊分析
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc + "20", borderColor: sc + "40" }]}>
          <Text style={[styles.statusTxt, { color: sc }]}>{kops.isOptimal ? "符合" : "需調整"}</Text>
        </View>
      </View>
      <Text style={[styles.kopsDesc, { color: colors.foreground }]}>{kops.description}</Text>
      {!kops.isOptimal && (
        <View style={[styles.suggestionBox, { backgroundColor: sc + "10", borderColor: sc + "30" }]}>
          <Feather name="info" size={13} color={sc} />
          <Text style={[styles.suggestionTxt, { color: sc }]}>{kops.suggestion}</Text>
        </View>
      )}
    </View>
  );
}

export default function ResultsScreen() {
  const {
    measurements,
    sixOClockAngles,
    threeOClockAngles,
    saveToHistory,
    clearSession,
  } = useAppContext();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const computed = useMemo(() => {
    if (!measurements || !sixOClockAngles) return null;
    const lemond = calculateLeMond(measurements);
    const sixAnalyses = analyzeAngles(sixOClockAngles, measurements.bikeType);
    const threeAnalyses = threeOClockAngles
      ? analyzeAngles(threeOClockAngles, measurements.bikeType)
      : [];
    const kops = threeOClockAngles ? analyzeKOPS(threeOClockAngles) : undefined;
    const allAnalyses = [...sixAnalyses, ...threeAnalyses];
    const fitScore = calculateFitScore(sixAnalyses);
    return { lemond, sixAnalyses, threeAnalyses, kops, fitScore, allAnalyses };
  }, [measurements, sixOClockAngles, threeOClockAngles]);

  if (!measurements || !sixOClockAngles || !computed) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyWrap, { paddingTop: topPad }]}>
          <Feather name="bar-chart-2" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>尚無分析結果</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            請先完成姿態擷取
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/analyze")}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.actionBtnTxt, { color: colors.primaryForeground }]}>
              前往分析
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { lemond, sixAnalyses, threeAnalyses, kops, fitScore } = computed;

  const scoreLabel =
    fitScore >= 90 ? "極佳" : fitScore >= 75 ? "良好" : fitScore >= 60 ? "尚可" : "需調整";
  const scoreColor =
    fitScore >= 90
      ? colors.success
      : fitScore >= 75
      ? colors.primary
      : fitScore >= 60
      ? colors.warning
      : "#ef4444";

  const handleSave = async () => {
    if (!measurements || !sixOClockAngles) return;
    const record: FittingRecord = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
      date: new Date().toISOString(),
      measurements,
      sixOClockAngles,
      threeOClockAngles: threeOClockAngles ?? undefined,
      lemond,
      analyses: computed.allAnalyses,
      kops,
      fitScore,
    };
    await saveToHistory(record);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("已儲存", "Fitting 記錄已儲存至歷史紀錄", [
      { text: "確定", style: "default" },
    ]);
  };

  const handleNewSession = () => {
    clearSession();
    router.push("/(tabs)/analyze");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>分析結果</Text>
        <Pressable onPress={handleSave} hitSlop={8} testID="button-save">
          <Feather name="save" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.scoreCard,
            { backgroundColor: colors.card, borderColor: scoreColor + "40" },
          ]}
        >
          <Text style={[styles.scoreNum, { color: scoreColor }]}>{fitScore}</Text>
          <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
          <Text style={[styles.scoreSub, { color: colors.mutedForeground }]}>
            綜合 Fitting 評分
          </Text>
        </View>

        <View style={[styles.lemondCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>座高建議</Text>
          <View style={styles.lemondRow}>
            <View style={styles.lemondItem}>
              <Text style={[styles.lemondLabel, { color: colors.mutedForeground }]}>
                建議座高
              </Text>
              <View style={styles.lemondValueRow}>
                <Text style={[styles.lemondValue, { color: colors.foreground }]}>
                  {lemond.saddleHeight}
                </Text>
                <Text style={[styles.lemondUnit, { color: colors.mutedForeground }]}>cm</Text>
              </View>
            </View>
            <View style={styles.lemondItem}>
              <Text style={[styles.lemondLabel, { color: colors.mutedForeground }]}>
                座高範圍
              </Text>
              <Text style={[styles.lemondRange, { color: colors.foreground }]}>
                {lemond.saddleHeightMin}-{lemond.saddleHeightMax}
              </Text>
            </View>
          </View>
        </View>

        {sixAnalyses.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              6 點鐘位置分析
            </Text>
            {sixAnalyses.map((a) => (
              <AngleCard key={a.name + "6"} analysis={a} />
            ))}
          </View>
        )}

        {threeAnalyses.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              3 點鐘位置分析
            </Text>
            {threeAnalyses.map((a) => (
              <AngleCard key={a.name + "3"} analysis={a} />
            ))}
          </View>
        )}

        {kops && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              KOPS 分析
            </Text>
            <KOPSCard kops={kops} />
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            testID="button-save-bottom"
          >
            <Feather name="save" size={18} color={colors.primaryForeground} />
            <Text style={[styles.saveBtnTxt, { color: colors.primaryForeground }]}>
              儲存記錄
            </Text>
          </Pressable>
          <Pressable
            onPress={handleNewSession}
            style={({ pressed }) => [
              styles.newBtn,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
            <Text style={[styles.newBtnTxt, { color: colors.mutedForeground }]}>
              重新分析
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  scoreCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 24,
    alignItems: "center",
    gap: 4,
  },
  scoreNum: { fontSize: 56, fontWeight: "800", lineHeight: 64, fontVariant: ["tabular-nums"] },
  scoreLabel: { fontSize: 22, fontWeight: "700" },
  scoreSub: { fontSize: 14 },
  lemondCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  lemondRow: { flexDirection: "row", gap: 16 },
  lemondItem: { flex: 1 },
  lemondLabel: { fontSize: 12, marginBottom: 4 },
  lemondValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  lemondValue: { fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  lemondUnit: { fontSize: 14 },
  lemondRange: { fontSize: 18, fontWeight: "600", fontVariant: ["tabular-nums"] },
  section: { gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  angleCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  angleHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  angleLeft: { flex: 1, gap: 2 },
  angleName: { fontSize: 16, fontWeight: "600" },
  angleDesc: { fontSize: 13, lineHeight: 18 },
  statusBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt: { fontSize: 13, fontWeight: "600" },
  angleValues: { flexDirection: "row", gap: 16 },
  angleValueItem: { flex: 1 },
  angleLabel: { fontSize: 12, marginBottom: 2 },
  angleNum: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  suggestionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  suggestionTxt: { fontSize: 13, lineHeight: 18, flex: 1 },
  kopsDesc: { fontSize: 15, lineHeight: 20 },
  actions: { gap: 10, marginTop: 4 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  saveBtnTxt: { fontSize: 16, fontWeight: "700" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  newBtnTxt: { fontSize: 15, fontWeight: "600" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  emptyDesc: { fontSize: 15, textAlign: "center" },
  actionBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  actionBtnTxt: { fontSize: 15, fontWeight: "600" },
});
