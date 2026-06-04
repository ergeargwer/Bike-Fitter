import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FittingRecord, useAppContext } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function scoreColor(score: number, colors: ReturnType<typeof useColors>) {
  if (score >= 90) return colors.success;
  if (score >= 75) return colors.primary;
  if (score >= 60) return colors.warning;
  return "#ef4444";
}

function scoreLabel(score: number) {
  if (score >= 90) return "極佳";
  if (score >= 75) return "良好";
  if (score >= 60) return "尚可";
  return "需調整";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function HistoryItem({
  record,
  onDelete,
}: {
  record: FittingRecord;
  onDelete: (id: string) => void;
}) {
  const colors = useColors();
  const sc = scoreColor(record.fitScore, colors);
  const sl = scoreLabel(record.fitScore);
  const bikeLabel = record.measurements.bikeType === "road" ? "公路車" : "三鐵車";

  const handleDelete = () => {
    Alert.alert("刪除記錄", "確定要刪除這筆 Fitting 記錄嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDelete(record.id);
        },
      },
    ]);
  };

  const goodCount = record.analyses.filter((a) => a.status === "符合").length;
  const totalCount = record.analyses.length;

  return (
    <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.itemTop}>
        <View style={styles.itemLeft}>
          <Text style={[styles.itemDate, { color: colors.mutedForeground }]}>
            {formatDate(record.date)}
          </Text>
          <View style={styles.itemMeta}>
            <View
              style={[
                styles.bikeTag,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.bikeTagTxt, { color: colors.mutedForeground }]}>
                {bikeLabel}
              </Text>
            </View>
            <Text style={[styles.metaTxt, { color: colors.mutedForeground }]}>
              身高 {record.measurements.height}cm
            </Text>
            <Text style={[styles.metaTxt, { color: colors.mutedForeground }]}>
              跨高 {record.measurements.inseam}cm
            </Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <Text style={[styles.scoreNum, { color: sc }]}>{record.fitScore}</Text>
          <Text style={[styles.scoreLabel, { color: sc }]}>{sl}</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.itemBottom}>
        <View style={styles.statRow}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <Text style={[styles.statTxt, { color: colors.foreground }]}>
            {goodCount}/{totalCount} 項符合
          </Text>
          <Text style={[styles.statSep, { color: colors.border }]}>·</Text>
          <Feather name="arrow-up" size={14} color={colors.primary} />
          <Text style={[styles.statTxt, { color: colors.foreground }]}>
            座高 {record.lemond.saddleHeight}cm
          </Text>
        </View>
        <Pressable
          onPress={handleDelete}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          testID={`delete-${record.id}`}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { history, deleteFitting } = useAppContext();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [refreshing] = useState(false);

  const renderItem = ({ item }: { item: FittingRecord }) => (
    <HistoryItem record={item} onDelete={deleteFitting} />
  );

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>歷史記錄</Text>
        {history.length > 0 && (
          <View
            style={[styles.countBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Text style={[styles.countTxt, { color: colors.mutedForeground }]}>
              {history.length}
            </Text>
          </View>
        )}
      </View>

      <FlatList<FittingRecord>
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={!!history.length}
        refreshing={refreshing}
        contentContainerStyle={[
          styles.list,
          !history.length && styles.emptyContainer,
          { paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 100 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="clock" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              尚無 Fitting 記錄
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              完成分析後點擊儲存即可在此查看
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
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
    gap: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  countBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countTxt: { fontSize: 16, fontWeight: "600" },
  list: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1 },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  itemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  itemLeft: { flex: 1, gap: 6 },
  itemDate: { fontSize: 16 },
  itemMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  bikeTag: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bikeTagTxt: { fontSize: 16, fontWeight: "500" },
  metaTxt: { fontSize: 16 },
  itemRight: { alignItems: "flex-end", gap: 2 },
  scoreNum: { fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"] },
  scoreLabel: { fontSize: 16, fontWeight: "600" },
  divider: { height: 1 },
  itemBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statTxt: { fontSize: 16 },
  statSep: { fontSize: 16 },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  emptyDesc: { fontSize: 16, textAlign: "center", lineHeight: 24 },
});
