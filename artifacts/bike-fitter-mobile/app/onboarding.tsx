import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export const ONBOARDING_KEY = "@bike_fitter_onboarding_done";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Slide {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
  detail: string;
}

const SLIDES: Slide[] = [
  {
    icon: "activity",
    title: "歡迎使用 Bike Fitter",
    body: "專業單車姿勢分析工具",
    detail:
      "透過鏡頭偵測您的騎乘姿勢，自動計算膝蓋、髖關節、軀幹與手肘角度，並對照 LeMond 公式給出個人化調整建議。",
  },
  {
    icon: "camera",
    title: "如何擺放手機",
    body: "側面拍攝、全身入鏡",
    detail:
      "將手機架在騎車時的正側面，距離約 2–3 公尺，高度與臀部齊平。確保整台自行車與您的全身都在畫面內，光源充足、背景簡潔。",
  },
  {
    icon: "check-circle",
    title: "分析流程",
    body: "兩個踩踏角度，完整評估",
    detail:
      "您需要在「6 點鐘」和「3 點鐘」踩踏位置各拍攝一次。拍攝時請靜止不動，系統會自動偵測關節並計算角度，完成後在「結果」頁查看建議。",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const dotAnim = useRef(SLIDES.map(() => new Animated.Value(0))).current;

  const topPad = Platform.OS === "web" ? 40 : insets.top;
  const bottomPad = Platform.OS === "web" ? 32 : insets.bottom;

  const animateDots = (index: number) => {
    dotAnim.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i === index ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
  };

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setCurrentIndex(index);
    animateDots(index);
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      goTo(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore storage errors
    }
    router.replace("/(tabs)");
  };

  React.useEffect(() => {
    animateDots(0);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.slideScroll}
      >
        {SLIDES.map((slide, index) => (
          <SlideView
            key={index}
            slide={slide}
            colors={colors}
            topPad={topPad}
          />
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: bottomPad + 16, borderTopColor: colors.border },
        ]}
      >
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const width = dotAnim[i].interpolate({
              inputRange: [0, 1],
              outputRange: [8, 24],
            });
            const bg = dotAnim[i].interpolate({
              inputRange: [0, 1],
              outputRange: [colors.border, colors.primary],
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width, backgroundColor: bg }]}
              />
            );
          })}
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.82 : 1,
              borderRadius: colors.radiusMd,
            },
          ]}
          testID="onboarding-next"
        >
          <Text style={[styles.nextBtnTxt, { color: colors.primaryForeground }]}>
            {currentIndex < SLIDES.length - 1 ? "下一步" : "開始使用"}
          </Text>
          <Feather
            name={currentIndex < SLIDES.length - 1 ? "arrow-right" : "check"}
            size={20}
            color={colors.primaryForeground}
          />
        </Pressable>

        {currentIndex < SLIDES.length - 1 && (
          <Pressable
            onPress={handleFinish}
            style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
            testID="onboarding-skip"
          >
            <Text style={[styles.skipTxt, { color: colors.mutedForeground }]}>
              略過
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SlideView({
  slide,
  colors,
  topPad,
}: {
  slide: Slide;
  colors: ReturnType<typeof useColors>;
  topPad: number;
}) {
  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH, paddingTop: topPad + 32 }]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.primary + "1a", borderColor: colors.primary + "33" },
        ]}
      >
        <Feather name={slide.icon} size={52} color={colors.primary} />
      </View>

      <Text style={[styles.slideTitle, { color: colors.foreground }]}>
        {slide.title}
      </Text>

      <Text style={[styles.slideBody, { color: colors.primary }]}>
        {slide.body}
      </Text>

      <Text style={[styles.slideDetail, { color: colors.mutedForeground }]}>
        {slide.detail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slideScroll: { flex: 1 },
  slide: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 20,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  slideBody: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  slideDetail: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    height: 8,
    marginBottom: 4,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    width: "100%",
  },
  nextBtnTxt: {
    fontSize: 17,
    fontWeight: "700",
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipTxt: {
    fontSize: 16,
  },
});
