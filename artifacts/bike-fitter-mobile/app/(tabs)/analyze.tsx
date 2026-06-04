import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";

import { PoseAngles, useAppContext } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { MEDIAPIPE_HTML } from "@/lib/mediapipeHtml";

const TAB_BAR_HEIGHT = 49;

type WebViewMessage =
  | { type: "captured"; position: "6oclock" | "3oclock"; angles: PoseAngles }
  | { type: "all_captured" }
  | { type: "reset" }
  | { type: "camera_error"; message: string }
  | { type: "engine_error"; message: string };

export default function AnalyzeScreen() {
  const { measurements, setSixOClockAngles, setThreeOClockAngles, clearSession } =
    useAppContext();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const [sixCaptured, setSixCaptured] = useState(false);
  const [threeCaptured, setThreeCaptured] = useState(false);
  const [webviewError, setWebviewError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : TAB_BAR_HEIGHT + insets.bottom;

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg: WebViewMessage = JSON.parse(event.nativeEvent.data);

      if (msg.type === "captured") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (msg.position === "6oclock") {
          setSixOClockAngles(msg.angles);
          setSixCaptured(true);
        } else {
          setThreeOClockAngles(msg.angles);
          setThreeCaptured(true);
        }
      } else if (msg.type === "all_captured") {
        router.push("/(tabs)/results");
      } else if (msg.type === "reset") {
        setSixCaptured(false);
        setThreeCaptured(false);
        clearSession();
      } else if (msg.type === "camera_error") {
        setWebviewError("相機存取失敗：" + msg.message);
      } else if (msg.type === "engine_error") {
        setWebviewError("姿態引擎載入失敗，請確認網路連線");
      }
    } catch {
      // ignore parse errors
    }
  };

  const handleGoToResults = () => {
    if (!sixCaptured) {
      Alert.alert("尚未擷取", "請至少完成 6 點鐘位置的姿態擷取");
      return;
    }
    router.push("/(tabs)/results");
  };

  if (!measurements) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyWrap, { paddingTop: topPad }]}>
          <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            請先輸入身體數據
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            回到首頁輸入身高、跨高等資訊
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)")}
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.backBtnTxt, { color: colors.primaryForeground }]}>
              前往首頁
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>姿態分析</Text>
        <View style={styles.captureStatus}>
          <View style={styles.statusDot}>
            <View
              style={[
                styles.dot,
                { backgroundColor: sixCaptured ? colors.success : colors.border },
              ]}
            />
            <Text
              style={[
                styles.statusTxt,
                { color: sixCaptured ? colors.success : colors.mutedForeground },
              ]}
            >
              6 點鐘
            </Text>
          </View>
          <View style={styles.statusDot}>
            <View
              style={[
                styles.dot,
                { backgroundColor: threeCaptured ? colors.success : colors.border },
              ]}
            />
            <Text
              style={[
                styles.statusTxt,
                { color: threeCaptured ? colors.success : colors.mutedForeground },
              ]}
            >
              3 點鐘
            </Text>
          </View>
        </View>
      </View>

      {webviewError ? (
        <View style={[styles.errorWrap, { backgroundColor: colors.background }]}>
          <Feather name="wifi-off" size={48} color={colors.mutedForeground} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            無法載入分析引擎
          </Text>
          <Text style={[styles.errorDesc, { color: colors.mutedForeground }]}>
            {webviewError}
          </Text>
          <Text style={[styles.errorHint, { color: colors.mutedForeground }]}>
            請確認網路連線後重試，MediaPipe 需要從網路載入
          </Text>
          <Pressable
            onPress={() => setWebviewError(null)}
            style={[styles.backBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
          >
            <Text style={[styles.backBtnTxt, { color: colors.primaryForeground }]}>
              重試
            </Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ html: MEDIAPIPE_HTML }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={["*"]}
          allowFileAccess
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          // iOS: auto-grant camera permission to the WebView (app-level permission already declared)
          mediaCapturePermissionGrantType="grant"
          onError={() => setWebviewError("WebView 載入失敗")}
          testID="mediapipe-webview"
        />
      )}

      {/* Spacer so WebView controls are not hidden behind the floating tab bar */}
      {!sixCaptured && !webviewError && (
        <View style={{ height: bottomPad }} />
      )}

      {sixCaptured && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + TAB_BAR_HEIGHT + 8,
            },
          ]}
        >
          <Pressable
            onPress={handleGoToResults}
            style={({ pressed }) => [
              styles.resultsBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            testID="button-go-to-results"
          >
            <Text style={[styles.resultsBtnTxt, { color: colors.primaryForeground }]}>
              查看分析結果
            </Text>
            <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      )}
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
  captureStatus: { flexDirection: "row", gap: 16 },
  statusDot: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 16, fontWeight: "500" },
  webview: { flex: 1 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  resultsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  resultsBtnTxt: { fontSize: 16, fontWeight: "700" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  emptyDesc: { fontSize: 16, textAlign: "center", lineHeight: 24 },
  backBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnTxt: { fontSize: 16, fontWeight: "600" },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  errorTitle: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  errorDesc: { fontSize: 16, textAlign: "center" },
  errorHint: { fontSize: 16, textAlign: "center", lineHeight: 24 },
});
